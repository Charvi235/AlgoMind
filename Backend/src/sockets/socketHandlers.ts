/**
 * socketHandlers.ts
 *
 * Registers all Socket.io events. Currently implements live-match
 * logic for Dijkstra; other games will plug into the same
 * roomManager + event shape later (round_data payload differs per
 * game, everything else is shared).
 */

import type { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
// Replace line 12:


import MatchResult, { IMatchResult } from "../models/MatchResult";

// Replace line 14:
import { recordActivityAndXP } from "../utils/activityTracker";
// Update the relative path to where your MatchResult type lives
// Update relative path to match your file structure
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
//import User from "../models/User";
//import MatchResult from "../models/MatchResult";
//import { recordActivityAndXP } from "../utils/activityTracker";

const MATCH_SECONDS = 60;
const DISCONNECT_GRACE_MS = 15000;

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

export function registerSocketHandlers(io: Server) {
  // ── Authenticate the socket connection (optional — guests allowed) ──
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (token) {
      try {
        const secret = process.env.JWT_SECRET!;
        const payload = jwt.verify(token, secret) as { userId: string };
        socket.data.userId = payload.userId;
      } catch {
        // Invalid/expired token — proceed as guest rather than blocking
        // the connection; guests just won't have results saved.
      }
    }
    next();
  });

  function startMatch(io: Server, room: Room) {
    room.status = "active";
    room.round = 1;
    const roundData = generateDijkstraRound(1); // TODO: branch by room.gameType when other games get live support
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
    // Single source of truth for final stats: used for winner decision,
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
      } catch (err) {
        console.error("Failed to save match result:", err);
      }

      // try {
      //   await MatchResult.create({
      //     gameType: room.gameType,
      //     roomId: room.roomId,
      //     players: matchPlayers,
      //     startedAt: new Date(Date.now() - MATCH_SECONDS * 1000),
      //     endedAt: new Date(),
      //   });

      //   // for (const mp of matchPlayers) {
      //   //   await recordActivityAndXP(mp.user_id as unknown as string, mp.xpEarned);
      //   // }
      // } catch (err) {
      //   console.error("Failed to save match result:", err);
      // }

    }
  }

  io.on("connection", (socket: Socket) => {
    const userId = socket.data.userId as string | undefined;

    // ── Random matchmaking ──────────────────────────────────────
    // socket.on("join_queue", async ({ gameType }: { gameType: string }) => {
    //   const username = userId ? (await User.findById(userId))?.username : undefined;

    //   const room = joinRandomQueue(gameType, socket.id, userId, username);
    //   if (room) {
    //     for (const p of room.players) io.sockets.sockets.get(p.socketId)?.join(room.roomId);
    //     io.to(room.roomId).emit("matched", { roomId: room.roomId });
    //     startMatch(io, room);
    //   } else {
    //     socket.emit("queue_joined");
    //   }
    // });

    // socket.on("cancel_queue", ({ gameType }: { gameType: string }) => {
    //   leaveQueue(gameType, socket.id);
    // });

    // ── Invite code flow ────────────────────────────────────────
 //   socket.on("create_room", async ({ gameType }: { gameType: string }) => {
    //   const username = userId ? (await User.findById(userId))?.username : undefined;

    //   const room = createRoom(gameType, socket.id, userId, username);
    //   socket.join(room.roomId);
    //   socket.emit("room_created", { roomId: room.roomId, code: room.code });
    // });

   // socket.on("join_room", async ({ code }: { code: string }) => {
    //  const username = userId ? (await User.findById(userId))?.username : undefined;

     // const room = joinRoomByCode(code, socket.id, userId, username);
     // if (!room) {
       // socket.emit("join_room_error", { message: "Room not found or already full." });
        //return;
      //}
      //socket.join(room.roomId);
      //io.to(room.roomId).emit("matched", { roomId: room.roomId });
      //startMatch(io, room);
    //});

        // Host leaves the invite screen before anyone joined: drop the empty
    // room so its code can't be used to "join" a host who already left.
    socket.on("cancel_room", () => {
      const room = getRoomBySocket(socket.id);
      if (room && room.status === "waiting") {
        socket.leave(room.roomId);
        removeRoom(room.roomId);
      }
    });
    // ── Reliable round-state fetch (handles race where match_start
    // fires before the client's Board component has mounted) ───────
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
      ({ currentNode, chosenNode }: { currentNode: string; chosenNode: string }) => {
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