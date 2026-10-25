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
  isValidNextStep,
} from "../utils/graphGenerator";
import User from "../models/User";
import MatchResult from "../models/MatchResult";
import GameSession from "../models/GameSession";
import { recordActivityAndXP } from "../utils/activityTracker";

const MATCH_SECONDS = 60;
const DISCONNECT_GRACE_MS = 15000;

// Games that have a live (multiplayer) implementation on the server.
const LIVE_GAMES = new Set(["dijkstra"]);

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

export function registerSocketHandlers(io: Server) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error("JWT_SECRET is not set");

  // ── Login required: reject the connection without a valid token ──────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string" || token.length === 0) {
      return next(new Error("AUTH_REQUIRED"));
    }
    try {
      const payload = jwt.verify(token, jwtSecret) as { userId?: string };
      if (!payload.userId) return next(new Error("AUTH_REQUIRED"));
      socket.data.userId = payload.userId;
      next();
    } catch {
      next(new Error("AUTH_REQUIRED"));
    }
  });

  function startMatch(io: Server, room: Room) {
    room.status = "active";
    room.round = 1;
    const roundData = generateDijkstraRound(1);
    room.currentRoundData = roundData;

    io.to(room.roomId).emit("match_start", publicRoundPayload(1, roundData));

    room.matchEndTimer = setTimeout(() => { void endMatch(io, room); }, MATCH_SECONDS * 1000);
  }

  function advanceRound(io: Server, room: Room) {
    room.round += 1;
    const roundData = generateDijkstraRound(room.round);
    room.currentRoundData = roundData;
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
      const gameType = typeof payload?.gameType === "string" ? payload.gameType : "";
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
    socket.on("create_room", async (payload?: { gameType?: unknown }) => {
      const gameType = typeof payload?.gameType === "string" ? payload.gameType : "";
      if (!LIVE_GAMES.has(gameType)) {
        socket.emit("live_unavailable", { message: "Live matches are not available for this game yet." });
        return;
      }
      const username = await lookupUsername(userId);

      const room = createRoom(gameType, socket.id, userId, username);
      socket.join(room.roomId);
      socket.emit("room_created", { roomId: room.roomId, code: room.code });
    });

    socket.on("join_room", async (payload?: { code?: unknown }) => {
      const code = typeof payload?.code === "string" ? payload.code.trim() : "";
      if (!/^[A-Za-z0-9]{6}$/.test(code)) {
        socket.emit("join_room_error", { message: "Room not found or already full." });
        return;
      }
      const username = await lookupUsername(userId);

      const room = joinRoomByCode(code, socket.id, userId, username);
      if (!room) {
        socket.emit("join_room_error", { message: "Room not found or already full." });
        return;
      }
      socket.join(room.roomId);
      io.to(room.roomId).emit("matched", { roomId: room.roomId });
      startMatch(io, room);
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
        player.attempts += 1;

        const correct = isValidNextStep(data.shortestPath, currentNode, chosenNode);
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