/**
 * socketHandlers.ts
 *
 * Registers all Socket.io events. Login is REQUIRED to connect: a socket
 * without a valid JWT is rejected during the handshake. Only Dijkstra has
 * live-match support for now; other games will plug into the same
 * roomManager + event shape later (round_data payload differs per game,
 * everything else is shared).
 */

import type { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import {
  createRoom,
  joinRoomByCode,
  joinRandomQueue,
  leaveQueue,
  getRoomBySocket,
  getOpponent,
  getPlayer,
  removeRoom,
  handleDisconnect,
  type Room,
} from "./roomManager";
import {
  generateGraph,
  dijkstraShortestPath,
  isValidShortestPathStep,
} from "../utils/graphGenerator";
import {
  generateBstQuestion,
  findBstInsertion,
  insertBstValue,
  type BSTNode,
} from "../utils/bstGenerator";
import User from "../models/User";
import MatchResult from "../models/MatchResult";
import GameSession from "../models/GameSession";
import { recordActivityAndXP } from "../utils/activityTracker";

const MATCH_SECONDS = 60;
const DISCONNECT_GRACE_MS = 15000;
const BST_MATCH_SECONDS = 120;
const BST_MAX_ROUNDS = 4;
const GUEST_ROOM_GAMES = new Set(["bst"]);

// Games that have a live (multiplayer) implementation on the server.
const LIVE_GAMES = new Set(["dijkstra", "bst"]);

export interface BstPlayerMatchState {
  socketId: string;
  userId?: string;
  username?: string;
  tree: BSTNode | null;
  nextExpectedIndex: number;
  correctCount: number;
  attempts: number;
  finished: boolean;
  roundCompleted: boolean;
  completedRounds: number;
}

export interface BstMatchState {
  round: number;
  sequence: number[];
  startedAt: number;
  endsAt: number;
  status: "active" | "finished";
  timer: NodeJS.Timeout | null;
  completed: boolean;
  winnerSocketId: string | null;
  players: BstPlayerMatchState[];
}

export function sanitizeGuestName(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const cleaned = raw.trim().replace(/[^A-Za-z0-9 _-]/g, "").slice(0, 20);
  if (!cleaned || cleaned.length < 2) return undefined;
  return cleaned;
}

export function isGuestAllowedGameType(gameType: unknown): boolean {
  return typeof gameType === "string" && GUEST_ROOM_GAMES.has(gameType.toLowerCase());
}

export function resolveSocketAuth(
  auth: Record<string, unknown> | undefined,
  jwtSecret: string,
  verify: (token: string, secret: string) => unknown = jwt.verify
): { userId?: string; isGuest?: boolean; guestName?: string; error?: string } {
  const token = typeof auth?.token === "string" && auth.token.length > 0 ? auth.token : undefined;
  const guestFlag = auth?.guest === true || auth?.guest === "true";

  if (token) {
    try {
      const payload = verify(token, jwtSecret) as { userId?: string };
      if (!payload.userId) {
        return { error: "AUTH_REQUIRED" };
      }
      return { userId: payload.userId, isGuest: false };
    } catch {
      return { error: "AUTH_REQUIRED" };
    }
  }

  if (guestFlag) {
    return { isGuest: true, guestName: sanitizeGuestName(auth?.username ?? auth?.displayName) ?? "Guest" };
  }

  return { error: "AUTH_REQUIRED" };
}

export function validateClientIdentity(socket: Socket, payload?: Record<string, unknown>): string | null {
  if (!payload || !Object.prototype.hasOwnProperty.call(payload, "userId")) return null;
  const clientUserId = payload.userId;
  if (typeof clientUserId === "undefined" || clientUserId === null) return null;
  if (socket.data.isGuest) {
    return "Guest sockets cannot claim a user ID.";
  }
  if (socket.data.userId && socket.data.userId !== clientUserId) {
    return "User identity is not accepted from the client payload.";
  }
  return null;
}

interface DijkstraRoundData {
  nodes: ReturnType<typeof generateGraph>["nodes"];
  edges: ReturnType<typeof generateGraph>["edges"];
  start: string;
  target: string;
  shortestPath: string[];
}

function generateDijkstraRound(round: number): DijkstraRoundData {
  const graph = generateGraph(round);
  const { path } = dijkstraShortestPath(graph.nodes, graph.edges, graph.start, graph.target);
  return { nodes: graph.nodes, edges: graph.edges, start: graph.start, target: graph.target, shortestPath: path };
}

function publicRoundPayload(round: number, data: DijkstraRoundData) {
  // Never send shortestPath to clients.
  return { round, nodes: data.nodes, edges: data.edges, start: data.start, target: data.target };
}

// A failed lookup must never crash the server (an unhandled rejection
// inside a socket handler would), so errors just mean "no username".
async function lookupUsername(userId: string | undefined): Promise<string | undefined> {
  if (!userId) return undefined;
  try {
    return (await User.findById(userId))?.username;
  } catch {
    return undefined;
  }
}

function buildBstPlayerState(
  socketId: string,
  userId: string | undefined,
  username: string | undefined,
  sequence: number[]
): BstPlayerMatchState {
  const rootValue = sequence[0];
  return {
    socketId,
    userId,
    username,
    tree: { value: rootValue, left: null, right: null },
    nextExpectedIndex: 1,
    correctCount: 1,
    attempts: 0,
    finished: sequence.length <= 1,
    roundCompleted: false,
    completedRounds: 0,
  };
}

function createBstMatchState(room: Room): BstMatchState {
  const sequence = generateBstQuestion(7);
  const now = Date.now();
  return {
    round: 1,
    sequence,
    startedAt: now,
    endsAt: now + BST_MATCH_SECONDS * 1000,
    status: "active",
    timer: null,
    completed: false,
    winnerSocketId: null,
    players: room.players.map((player) => buildBstPlayerState(player.socketId, player.userId, player.username, sequence)),
  };
}

function getBstMatch(room: Room): BstMatchState | null {
  return room.bstState ?? null;
}

function getBstPlayerState(room: Room, socketId: string): BstPlayerMatchState | null {
  const match = getBstMatch(room);
  if (!match) return null;
  return match.players.find((p) => p.socketId === socketId) ?? null;
}

function computeBstAccuracy(player: BstPlayerMatchState): number {
  const totalAttempts = Math.max(player.attempts, 1);
  const correctMoves = Math.max(player.correctCount - 1, 0);
  return Number(((correctMoves / totalAttempts) * 100).toFixed(2));
}

function makeBstProgressPayload(room: Room) {
  const match = getBstMatch(room);
  if (!match) return { roomId: room.roomId, gameType: "bst", players: [] };

  return {
    roomId: room.roomId,
    gameType: "bst",
    players: match.players.map((player) => ({
      socketId: player.socketId,
      username: player.username ?? "Guest",
      correctCount: player.correctCount,
      attempts: player.attempts,
      nextExpectedIndex: player.nextExpectedIndex,
      finished: player.finished,
      roundsCompleted: player.completedRounds,
      accuracy: computeBstAccuracy(player),
    })),
  };
}

function emitBstProgress(io: Server, room: Room) {
  io.to(room.roomId).emit("bst_progress", makeBstProgressPayload(room));
}

function finalizeBstMatch(io: Server, room: Room, reason: "winner" | "timeout" | "disconnect", winnerSocketId?: string | null): void {
  const match = getBstMatch(room);
  if (!match || match.completed) return;

  match.completed = true;
  match.status = "finished";
  if (match.timer) {
    clearTimeout(match.timer);
    match.timer = null;
  }

  const resolvedWinner = winnerSocketId ?? match.winnerSocketId ?? (() => {
    const [first, second] = match.players;
    if (!first || !second) return null;
    const firstFinished = first.nextExpectedIndex >= match.sequence.length;
    const secondFinished = second.nextExpectedIndex >= match.sequence.length;
    if (firstFinished && !secondFinished) return first.socketId;
    if (secondFinished && !firstFinished) return second.socketId;
    if (first.correctCount !== second.correctCount) {
      return first.correctCount > second.correctCount ? first.socketId : second.socketId;
    }
    const firstAccuracy = computeBstAccuracy(first);
    const secondAccuracy = computeBstAccuracy(second);
    if (firstAccuracy !== secondAccuracy) {
      return firstAccuracy > secondAccuracy ? first.socketId : second.socketId;
    }
    return null;
  })();

  match.winnerSocketId = resolvedWinner;
  room.status = "finished";

  const results = match.players.map((player) => ({
    socketId: player.socketId,
    username: player.username ?? null,
    correctCount: player.correctCount,
    attempts: player.attempts,
    accuracy: computeBstAccuracy(player),
    completed: player.finished,
    roundsCompleted: player.completedRounds,
    xp: Math.max(0, player.correctCount - player.completedRounds) * 10,
  }));

  io.to(room.roomId).emit("bst_match_end", {
    roomId: room.roomId,
    gameType: "bst",
    reason,
    winnerSocketId: resolvedWinner,
    results,
  });

  const saveMatchResult = async () => {
    const loggedIn = match.players.filter((player) => player.userId);
    if (loggedIn.length === 0) return;

    try {
      await MatchResult.create({
        gameType: "bst",
        roomId: room.roomId,
        players: loggedIn.map((player) => {
          const accuracy = computeBstAccuracy(player);
          const xpEarned = Math.max(0, player.correctCount - player.completedRounds) * 10;
          return {
            user_id: player.userId!,
            username: player.username ?? "Unknown",
            correctCount: Math.max(0, player.correctCount - player.completedRounds),
            totalRounds: player.completedRounds,
            accuracy,
            xpEarned,
            result: resolvedWinner === null
              ? "tie"
              : resolvedWinner === player.socketId
                ? "win"
                : "loss",
          };
        }),
        startedAt: new Date(match.startedAt),
        endedAt: new Date(),
      });

      await Promise.all(loggedIn.map((player) =>
        recordActivityAndXP(player.userId!, player.correctCount * 10)
      ));
    } catch (error) {
      console.error("Failed to save BST match result:", error);
    }
  };

  void saveMatchResult();
  removeRoom(room.roomId);
}

function advanceBstRound(io: Server, room: Room): void {
  const match = getBstMatch(room);
  if (!match || match.completed || room.status !== "active") return;
  if (match.round >= BST_MAX_ROUNDS) return;

  match.round += 1;
  match.sequence = generateBstQuestion(7);
  room.currentRoundData = match.sequence;
  for (const player of match.players) {
    player.tree = { value: match.sequence[0], left: null, right: null };
    player.nextExpectedIndex = 1;
    player.finished = false;
    player.roundCompleted = false;
  }

  io.to(room.roomId).emit("bst_round_start", {
    roomId: room.roomId,
    gameType: "bst",
    round: match.round,
    sequence: match.sequence,
  });
  emitBstProgress(io, room);
}

function startBstMatch(io: Server, room: Room): void {
  if (!room || room.gameType !== "bst") return;
  if (room.bstState && room.bstState.completed) return;
  if (room.players.length < 2) return;

  const match = createBstMatchState(room);
  room.bstState = match;
  room.currentRoundData = match.sequence;
  room.status = "active";

  const startedAt = match.startedAt;
  const timeoutMs = BST_MATCH_SECONDS * 1000;
  match.timer = setTimeout(() => {
    if (!room.bstState || room.bstState.completed) return;
    finalizeBstMatch(io, room, "timeout");
  }, timeoutMs);

  io.to(room.roomId).emit("bst_match_start", {
    roomId: room.roomId,
    gameType: "bst",
    round: match.round,
    sequence: match.sequence,    startedAt,
    endsAt: match.endsAt,
    timeoutMs,
  });

  emitBstProgress(io, room);
}

export function evaluateBstMove(room: Room, socketId: string, payload: unknown): {
  valid: boolean;
  reason?: string;
  expectedValue?: number;
  actualValue?: number;
  nextExpectedIndex?: number;
  player?: BstPlayerMatchState;
  detail?: string;
} {
  const match = getBstMatch(room);
  if (!match || match.completed || room.status !== "active") {
    return { valid: false, reason: "match_not_active", detail: "The BST match is not active." };
  }

  const player = getBstPlayerState(room, socketId);
  if (!player) {
    return { valid: false, reason: "not_in_room", detail: "You are not in this room." };
  }
  if (player.finished) {
    return { valid: false, reason: "already_finished", detail: "This player has already completed the BST." };
  }

  if (!payload || typeof payload !== "object") {
    return { valid: false, reason: "malformed_payload", detail: "Move payload must be an object." };
  }

  const value = (payload as { value?: unknown }).value;
  const parentValue = (payload as { parentValue?: unknown }).parentValue;
  const side = (payload as { side?: unknown }).side;
  const roomId = (payload as { roomId?: unknown }).roomId;

  if (roomId != null && String(roomId) !== room.roomId) {
    return { valid: false, reason: "wrong_room", detail: "Room mismatch." };
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { valid: false, reason: "invalid_value", detail: "Value must be a finite number." };
  }

  const expectedValue = match.sequence[player.nextExpectedIndex];
  if (typeof expectedValue !== "number") {
    return { valid: false, reason: "already_finished", detail: "No remaining values to place." };
  }

  if (value !== expectedValue) {
    return {
      valid: false,
      reason: "out_of_order",
      expectedValue,
      actualValue: value,
      nextExpectedIndex: player.nextExpectedIndex,
      player,
      detail: `Expected ${expectedValue} next, received ${value}.`,
    };
  }

  const hasParent = parentValue !== undefined && parentValue !== null;
  const sideValue = side === "left" || side === "right" ? side : null;
  if (hasParent && typeof parentValue !== "number") {
    return { valid: false, reason: "invalid_parent", detail: "Parent value must be a number when supplied." };
  }
  if (sideValue === null && hasParent) {
    return { valid: false, reason: "invalid_side", detail: "A parent value requires a left/right direction." };
  }

  const insertion = findBstInsertion(player.tree, value);
  if (!insertion.valid) {
    return { valid: false, reason: "invalid_position", detail: "This value cannot be placed in the current BST." };
  }

  if (hasParent || sideValue) {
    if (insertion.parentValue !== parentValue || insertion.side !== sideValue) {
      return {
        valid: false,
        reason: "invalid_parent_side",
        expectedValue,
        actualValue: value,
        nextExpectedIndex: player.nextExpectedIndex,
        player,
        detail: "The supplied parent/side does not match the BST insertion position.",
      };
    }
  }

  return { valid: true, expectedValue, actualValue: value, nextExpectedIndex: player.nextExpectedIndex, player };
}

export function applyBstMove(io: Server, room: Room, socketId: string, payload: unknown): { valid: boolean; reason?: string; detail?: string } {
  const match = getBstMatch(room);
  if (!match || match.completed || room.status !== "active") {
    return { valid: false, reason: "match_not_active", detail: "The BST match is not active." };
  }

  const player = getBstPlayerState(room, socketId);
  if (!player) {
    return { valid: false, reason: "not_in_room", detail: "You are not in this room." };
  }

  const result = evaluateBstMove(room, socketId, payload);
  if (!result.valid) {
    player.attempts += 1;
    const response = {
      valid: false,
      reason: result.reason ?? "invalid_move",
      detail: result.detail ?? "Invalid BST move.",
      expectedValue: result.expectedValue,
      nextExpectedIndex: player.nextExpectedIndex,
      attempts: player.attempts,
    };
    io.sockets.sockets.get(socketId)?.emit("bst_move_result", response);
    emitBstProgress(io, room);
    return response;
  }

  const expectedValue = result.expectedValue ?? match.sequence[player.nextExpectedIndex];
  const insertedTree = insertBstValue(player.tree, expectedValue);
  if (!insertedTree) {
    player.attempts += 1;
    const response = {
      valid: false,
      reason: "duplicate_value",
      detail: "This value has already been placed.",
      expectedValue,
      nextExpectedIndex: player.nextExpectedIndex,
      attempts: player.attempts,
    };
    io.sockets.sockets.get(socketId)?.emit("bst_move_result", response);
    emitBstProgress(io, room);
    return { valid: false, reason: "duplicate_value", detail: "This value has already been placed." };
  }

  player.tree = insertedTree;
  player.nextExpectedIndex += 1;
  player.correctCount = Math.max(player.nextExpectedIndex, 1);
  player.attempts += 1;
  player.finished = player.nextExpectedIndex >= match.sequence.length;

  const response = {
    valid: true,
    socketId,
    expectedValue,
    nextExpectedIndex: player.nextExpectedIndex,
    correctCount: player.correctCount,
    attempts: player.attempts,
    finished: player.finished,
  };

  io.sockets.sockets.get(socketId)?.emit("bst_move_result", response);
  io.to(room.roomId).emit("bst_progress", makeBstProgressPayload(room));

  if (player.finished && !player.roundCompleted) {
    player.roundCompleted = true;
    player.completedRounds += 1;
    emitBstProgress(io, room);

    if (player.completedRounds >= BST_MAX_ROUNDS) {
      finalizeBstMatch(io, room, "winner", socketId);
      return { valid: true };
    }

    if (match.players.every((entry) => entry.roundCompleted)) {
      advanceBstRound(io, room);
    } else {
      io.sockets.sockets.get(socketId)?.emit("bst_round_waiting", {
        round: match.round,
        waitingForOpponent: true,
      });
    }
  }

  return { valid: true };
}

export function registerSocketHandlers(io: Server) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error("JWT_SECRET is not set");

  // ── Auth policy: valid JWTs remain the default, while guest room-code
  //    BST flows are allowed only when the client explicitly opts in.
  io.use((socket, next) => {
    const auth = (socket.handshake.auth ?? {}) as Record<string, unknown>;
    const resolved = resolveSocketAuth(auth, jwtSecret);

    if (resolved.error) {
      return next(new Error(resolved.error));
    }

    if (resolved.userId) {
      socket.data.userId = resolved.userId;
      socket.data.isGuest = false;
    } else {
      socket.data.userId = undefined;
      socket.data.isGuest = resolved.isGuest === true;
      if (resolved.guestName) socket.data.guestName = resolved.guestName;
    }

    next();
  });

  function startMatch(io: Server, room: Room) {
    room.status = "active";
    room.round = 1;
    const roundData = generateDijkstraRound(1);
    room.currentRoundData = roundData;

    // Initialise every player's server-tracked position to the round's start.
    for (const p of room.players) p.currentNode = roundData.start;

    io.to(room.roomId).emit("match_start", publicRoundPayload(1, roundData));

    room.matchEndTimer = setTimeout(() => { void endMatch(io, room); }, MATCH_SECONDS * 1000);
  }

  function advanceRound(io: Server, room: Room) {
    room.round += 1;
    const roundData = generateDijkstraRound(room.round);
    room.currentRoundData = roundData;

    // Reset every player's server-tracked position to the new round's start.
    for (const p of room.players) p.currentNode = roundData.start;

    io.to(room.roomId).emit("round_data", publicRoundPayload(room.round, roundData));
  }

  async function endMatch(io: Server, room: Room) {
    // Single source of truth for final stats: used for the winner decision,
    // the match_end payload AND the DB save.
    // Accuracy = correct steps / all attempts (wrong clicks count).
    const stats = room.players.map((p) => ({
      socketId: p.socketId,
      userId: p.userId,
      username: p.username ?? null,
      roundsCompleted: p.correctCount,
      accuracy: p.attempts > 0 ? Math.round((p.totalActions / p.attempts) * 100) : 0,
      xp: p.correctCount * 10,
    }));

    // Winner: more rounds wins; if rounds are equal, higher accuracy wins;
    // only if both are equal is it a real tie (winnerSocketId stays null).
    let winnerSocketId: string | null = null;
    const [a, b] = stats;
    if (a && b) {
      if (a.roundsCompleted !== b.roundsCompleted) {
        winnerSocketId = a.roundsCompleted > b.roundsCompleted ? a.socketId : b.socketId;
      } else if (a.accuracy !== b.accuracy) {
        winnerSocketId = a.accuracy > b.accuracy ? a.socketId : b.socketId;
      }
    }

    io.to(room.roomId).emit("match_end", {
      results: stats.map((s) => ({
        socketId: s.socketId,
        username: s.username,
        roundsCompleted: s.roundsCompleted,
        accuracy: s.accuracy,
        xp: s.xp,
      })),
      winnerSocketId,
    });

    // Remove the room BEFORE the async DB work, so a late disconnect
    // timer can't trigger a second endMatch and double-save.
    removeRoom(room.roomId);

    const resultFor = (socketId: string): "win" | "loss" | "tie" =>
      !winnerSocketId ? "tie" : socketId === winnerSocketId ? "win" : "loss";

    const loggedIn = stats.filter((s) => s.userId);
    if (loggedIn.length > 0) {
      try {
        await MatchResult.create({
          gameType: room.gameType,
          roomId: room.roomId,
          players: loggedIn.map((s) => ({
            user_id: s.userId!,
            username: s.username ?? "Unknown",
            correctCount: s.roundsCompleted,
            totalRounds: s.roundsCompleted,
            accuracy: s.accuracy,
            xpEarned: s.xp,
            result: resultFor(s.socketId),
          })),
          startedAt: new Date(Date.now() - MATCH_SECONDS * 1000),
          endedAt: new Date(),
        });

               for (const s of loggedIn) {
          await recordActivityAndXP(s.userId!, s.xp);
        }

        await GameSession.create(
          loggedIn.map((s) => ({
            userId: s.userId,
            gameType: room.gameType,
            mode: "live" as const,
            status: "completed" as const,
            roundsCompleted: s.roundsCompleted,
            accuracy: s.accuracy,
            xpEarned: s.xp,
            roomId: room.roomId,
            startedAt: new Date(Date.now() - MATCH_SECONDS * 1000),
            completedAt: new Date(),
            durationSeconds: MATCH_SECONDS,
          }))
        );
      } catch (err) {
        console.error("Failed to save match result:", err);
      }
    }
  }

  io.on("connection", (socket: Socket) => {
    const userId = socket.data.userId as string;

    // ── Random matchmaking ──────────────────────────────────────
    socket.on("join_queue", async (payload?: { gameType?: unknown }) => {
      const gameType = typeof payload?.gameType === "string" ? payload.gameType.toLowerCase() : "";
      if (socket.data.isGuest) {
        socket.emit("live_unavailable", { message: "Guests must use a room code for BST matches." });
        return;
      }
      if (gameType === "sorting") return;
      if (!LIVE_GAMES.has(gameType)) {
        socket.emit("live_unavailable", { message: "Live matches are not available for this game yet." });
        return;
      }
      const username = await lookupUsername(userId);

      const room = joinRandomQueue(gameType, socket.id, userId, username);
      if (room) {
        for (const p of room.players) io.sockets.sockets.get(p.socketId)?.join(room.roomId);
        io.to(room.roomId).emit("matched", { roomId: room.roomId });
        startMatch(io, room);
      } else {
        socket.emit("queue_joined");
      }
    });

    socket.on("cancel_queue", (payload?: { gameType?: unknown }) => {
      if (typeof payload?.gameType === "string") leaveQueue(payload.gameType, socket.id);
    });

    // ── Invite code flow ────────────────────────────────────────
    socket.on("create_room", async (payload?: { gameType?: unknown; userId?: unknown }) => {
      const gameType = typeof payload?.gameType === "string" ? payload.gameType.toLowerCase() : "";
      const identityError = validateClientIdentity(socket, payload as Record<string, unknown> | undefined);
      if (identityError) {
        socket.emit("live_unavailable", { message: identityError });
        return;
      }
      if (socket.data.isGuest && !isGuestAllowedGameType(gameType)) {
        socket.emit("live_unavailable", { message: "Guests can only create BST room-code matches." });
        return;
      }
      if (gameType === "sorting") return;
      if (!LIVE_GAMES.has(gameType)) {
        socket.emit("live_unavailable", { message: "Live matches are not available for this game yet." });
        return;
      }

      const username = await lookupUsername(userId) ?? (socket.data.guestName as string | undefined);
      const existingRoom = getRoomBySocket(socket.id);
      if (existingRoom && existingRoom.status === "waiting") {
        socket.join(existingRoom.roomId);
        socket.emit("room_created", { roomId: existingRoom.roomId, code: existingRoom.code, gameType: existingRoom.gameType });
        return;
      }
      if (existingRoom && existingRoom.status !== "waiting") {
        socket.emit("live_unavailable", { message: "You already have an active match." });
        return;
      }

      const room = createRoom(gameType, socket.id, userId, username);
      if (!room) {
        socket.emit("live_unavailable", { message: "You already have an active room." });
        return;
      }
      socket.join(room.roomId);
      socket.emit("room_created", { roomId: room.roomId, code: room.code, gameType: room.gameType });
    });

    socket.on("join_room", async (payload?: { code?: unknown; gameType?: unknown; userId?: unknown }) => {
      const gameType = typeof payload?.gameType === "string" ? payload.gameType.toLowerCase() : "";
      const identityError = validateClientIdentity(socket, payload as Record<string, unknown> | undefined);
      if (identityError) {
        socket.emit("join_room_error", { message: identityError });
        return;
      }
      if (socket.data.isGuest && !isGuestAllowedGameType(gameType)) {
        socket.emit("join_room_error", { message: "Guests can only join BST room-code matches." });
        return;
      }
      if (payload?.gameType === "sorting") return;
      const code = typeof payload?.code === "string" ? payload.code.trim().toUpperCase() : "";
      if (!/^[A-Za-z0-9]{6}$/.test(code)) {
        socket.emit("join_room_error", { message: "Enter a valid 6-character room code." });
        return;
      }
      if (!LIVE_GAMES.has(gameType)) {
        socket.emit("join_room_error", { message: "Live matches are not available for this game yet." });
        return;
      }
      const username = await lookupUsername(userId) ?? (socket.data.guestName as string | undefined);

      const room = joinRoomByCode(code, socket.id, userId, username);
      if (!room) {
        socket.emit("join_room_error", { message: "Room not found, full, or no longer waiting." });
        return;
      }
      socket.join(room.roomId);
      socket.emit("room_joined", { roomId: room.roomId, gameType: room.gameType, code: room.code });
      io.to(room.roomId).emit("matched", { roomId: room.roomId, gameType: room.gameType, code: room.code });
      if (room.gameType === "bst") {
        const host = room.players[0];
        if (host) io.to(host.socketId).emit("opponent_joined", { roomId: room.roomId, gameType: room.gameType, code: room.code });
        startBstMatch(io, room);
      } else {
        startMatch(io, room);
      }
    });

    // Host leaves the invite screen before anyone joined: drop the empty
    // room so its code can't be used to "join" a host who already left.
    socket.on("cancel_room", () => {
      const room = getRoomBySocket(socket.id);
      if (room && room.status === "waiting") {
        socket.leave(room.roomId);
        removeRoom(room.roomId);
      }
    });

    socket.on("bst_submit_move", (payload?: unknown) => {
      const room = getRoomBySocket(socket.id);
      if (!room || room.gameType !== "bst") {
        socket.emit("bst_move_result", { valid: false, reason: "not_in_bst_room", detail: "You are not in an active BST room." });
        return;
      }
      const match = getBstMatch(room);
      if (!match || match.completed || room.status !== "active") {
        socket.emit("bst_move_result", { valid: false, reason: "match_not_active", detail: "The BST match is not active." });
        return;
      }
      applyBstMove(io, room, socket.id, payload);
    });

    socket.on("request_bst_round_state", (payload?: unknown) => {
      const room = getRoomBySocket(socket.id);
      const requestedRoomId = payload && typeof payload === "object" && "roomId" in payload
        ? String((payload as { roomId?: unknown }).roomId ?? "")
        : "";
      if (!room || room.gameType !== "bst" || room.status !== "active" || !room.bstState) return;
      if (requestedRoomId && requestedRoomId !== room.roomId) return;

      const match = room.bstState;
      socket.emit("bst_round_state", {
        roomId: room.roomId,
        gameType: "bst",
        round: match.round,
        sequence: match.sequence,
        startedAt: match.startedAt,
        endsAt: match.endsAt,
        timeoutMs: BST_MATCH_SECONDS * 1000,
      });
    });

    // ── Reliable round-state fetch (handles the race where match_start
    // fires before the client's Board component has mounted) ──────────
    socket.on("request_round_state", () => {
      const room = getRoomBySocket(socket.id);
      if (!room || !room.currentRoundData) return;
      const data = room.currentRoundData as DijkstraRoundData;
      socket.emit("round_state", {
        round: room.round,
        nodes: data.nodes,
        edges: data.edges,
        start: data.start,
        target: data.target,
      });
    });

    // ── Gameplay ─────────────────────────────────────────────────
    socket.on(
      "submit_step",
      (payload?: { currentNode?: unknown; chosenNode?: unknown }) => {
        const currentNode = payload?.currentNode;
        const chosenNode = payload?.chosenNode;
        if (typeof currentNode !== "string" || typeof chosenNode !== "string") return;

        const room = getRoomBySocket(socket.id);
        if (!room || room.status !== "active" || !room.currentRoundData) return;

        const data = room.currentRoundData as DijkstraRoundData;
        const player = getPlayer(room, socket.id);
        if (!player) return;

        // 1. Count every attempt (correct or wrong) for accuracy.
        player.attempts += 1;

        // 2. Reset button: client sends currentNode === start, so sync
        //    the server's position back to start as well.
        if (currentNode === data.start) {
          player.currentNode = data.start;
        }

        // 3. Position check: reject moves from a node the server did not
        //    place the player at (prevents skipping steps).
        if (currentNode !== player.currentNode) {
          socket.emit("step_result", { correct: false, isComplete: false });
          return;
        }

        // 4. Validate against all shortest paths (not just the stored one).
        const correct = isValidShortestPathStep(
          data.nodes,
          data.edges,
          data.start,
          data.target,
          currentNode,
          chosenNode,
        );
        if (correct) player.currentNode = chosenNode;

        // 5. Reply, update counters, advance round on completion — unchanged.
        const isComplete = correct && chosenNode === data.target;

        socket.emit("step_result", { correct, isComplete });

        if (correct) {
          player.totalActions += 1;
          if (isComplete) {
            player.correctCount += 1;
            player.score += 10;
            const opponent = getOpponent(room, socket.id);
            if (opponent) {
              io.to(opponent.socketId).emit("opponent_progress", {
                score: player.score,
                correctCount: player.correctCount,
              });
            }
            advanceRound(io, room);
          }
        }
      }
    );

    // ── Disconnect handling ─────────────────────────────────────
    socket.on("disconnect", () => {
      const room = handleDisconnect(socket.id);
      if (!room || room.status === "finished") return;

      const opponent = getOpponent(room, socket.id);
      if (room.gameType === "bst") {
        if (opponent) {
          io.to(opponent.socketId).emit("opponent_left", { gameType: room.gameType, graceMs: DISCONNECT_GRACE_MS });
          setTimeout(() => {
            const stillExists = getRoomBySocket(opponent.socketId);
            if (stillExists && stillExists.roomId === room.roomId && stillExists.gameType === "bst") {
              const bstMatch = stillExists.bstState;
              if (bstMatch && !bstMatch.completed) {
                finalizeBstMatch(io, stillExists, "disconnect", opponent.socketId);
              }
            }
          }, DISCONNECT_GRACE_MS);
        } else {
          removeRoom(room.roomId);
        }
        return;
      }

      if (opponent) {
        io.to(opponent.socketId).emit("opponent_left", { graceMs: DISCONNECT_GRACE_MS });
        // Grace period: if the disconnected player doesn't return, end
        // the match early with whoever remains as the winner.
        setTimeout(() => {
          const stillExists = getRoomBySocket(opponent.socketId);
          if (stillExists && stillExists.roomId === room.roomId) {
            void endMatch(io, room);
          }
        }, DISCONNECT_GRACE_MS);
      } else {
        removeRoom(room.roomId);
      }
    });
  });
}