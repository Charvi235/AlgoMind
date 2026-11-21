import type { Server, Socket } from "socket.io";
import { generateSortRound, publicSortStep } from "../utils/sortingEngine";
import GameSession from "../models/GameSession";
import MatchResult from "../models/MatchResult";
import User from "../models/User";
import { recordActivityAndXP } from "../utils/activityTracker";
import { validateClientIdentity } from "./socketHandlers";
import {
  addToSortingQueue,
  createRandomSortingRoom,
  createSortingRoom,
  getOpponent,
  getPlayer,
  getRoomById,
  getRoomBySocket,
  joinSortingRoom,
  removeFromQueue,
  removeRoom,
  removeSocketFromRoom,
  type SortingRoom,
} from "./sortingRoomManager";

const MATCH_SECONDS = 420;

function publicRound(room: SortingRoom, socketId: string) {
  const data = room.currentRound;
  const player = getPlayer(room, socketId);
  if (!data || !player) return null;
  const completed = player.completedRound;
  return {
    roomId: room.roomId,
    round: room.round,
    algo: data.algo,
    totalSteps: data.steps.length,
    stepIndex: player.stepIndex,
    step: completed ? null : publicSortStep(data.steps[player.stepIndex]),
    completed,
    finalArr: completed ? data.finalArr : undefined,
  };
}

function startMatch(io: Server, room: SortingRoom): void {
  room.status = "active";
  room.round = 1;
  room.startedAt = new Date();
  room.currentRound = generateSortRound(room.round);
  io.to(room.roomId).emit("sorting_match_start", {
    roomId: room.roomId,
    round: room.round,
    algo: room.currentRound.algo,
    totalSteps: room.currentRound.steps.length,
    seconds: MATCH_SECONDS,
  });
  room.endTimer = setTimeout(() => {
    void endMatch(io, room);
  }, MATCH_SECONDS * 1000);
}

function advanceRound(io: Server, room: SortingRoom): void {
  if (room.roundAdvanceTimer) clearTimeout(room.roundAdvanceTimer);
  room.roundAdvanceTimer = undefined;
  room.round += 1;
  room.currentRound = generateSortRound(room.round);
  for (const player of room.players) {
    player.stepIndex = 0;
    player.completedRound = false;
  }
  io.to(room.roomId).emit("sorting_round_data", {
    roomId: room.roomId,
    round: room.round,
    algo: room.currentRound.algo,
    totalSteps: room.currentRound.steps.length,
  });
}

async function endMatch(io: Server, room: SortingRoom): Promise<void> {
  const players = room.players.map((player) => ({
    socketId: player.socketId,
    userId: player.userId,
    roundsCompleted: player.roundsCompleted,
    attempts: player.attempts,
    correctCount: player.correctActions,
    accuracy: player.attempts > 0
      ? Math.round((player.correctActions / player.attempts) * 100)
      : 0,
    score: player.score,
  }));

  let winnerSocketId: string | null = null;
  const [first, second] = players;
  if (first && second) {
    if (first.score !== second.score) {
      winnerSocketId = first.score > second.score ? first.socketId : second.socketId;
    } else if (first.accuracy !== second.accuracy) {
      winnerSocketId = first.accuracy > second.accuracy ? first.socketId : second.socketId;
    }
  }

  io.to(room.roomId).emit("sorting_match_end", { roomId: room.roomId, players, winnerSocketId });
  removeRoom(room.roomId);

  const loggedIn = players.filter((player) => player.userId);
  if (loggedIn.length === 0) return;

  const endedAt = new Date();
  const startedAt = room.startedAt ?? new Date(endedAt.getTime() - MATCH_SECONDS * 1000);
  const durationSeconds = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));
  const resultFor = (socketId: string): "win" | "loss" | "tie" =>
    winnerSocketId === null ? "tie" : socketId === winnerSocketId ? "win" : "loss";

  try {
    const users = await User.find({ _id: { $in: loggedIn.map((player) => player.userId) } })
      .select("username")
      .lean();
    const usernames = new Map(users.map((user) => [String(user._id), user.username]));

    await MatchResult.create({
      gameType: "sorting",
      roomId: room.roomId,
      players: loggedIn.map((player) => ({
        user_id: player.userId,
        username: usernames.get(player.userId) ?? "Unknown",
        correctCount: player.correctCount,
        totalRounds: player.roundsCompleted,
        accuracy: player.accuracy,
        xpEarned: player.score,
        result: resultFor(player.socketId),
      })),
      startedAt,
      endedAt,
    });

    await GameSession.create(loggedIn.map((player) => ({
      userId: player.userId,
      gameType: "sorting",
      mode: "live" as const,
      status: "completed" as const,
      roundsCompleted: player.roundsCompleted,
      attempts: player.attempts,
      correctSteps: player.correctCount,
      accuracy: player.accuracy,
      xpEarned: player.score,
      roomId: room.roomId,
      startedAt,
      completedAt: endedAt,
      durationSeconds,
    })));

    await Promise.all(loggedIn.map((player) =>
      recordActivityAndXP(player.userId, player.score)
    ));
  } catch (error) {
    console.error("Failed to save Sorting match result:", error);
  }
}

function emitRoomError(socket: Socket, message: string): void {
  socket.emit("sorting_room_error", { message });
}

function validateSortingAccess(
  socket: Socket,
  payload?: Record<string, unknown>
): string | null {
  const identityError = validateClientIdentity(socket, payload);
  if (identityError) {
    emitRoomError(socket, identityError);
    return null;
  }
  if (socket.data.isGuest === true) {
    emitRoomError(socket, "Guests cannot access Sorting multiplayer.");
    return null;
  }
  if (typeof socket.data.userId !== "string" || !socket.data.userId) {
    emitRoomError(socket, "Authentication is required for Sorting multiplayer.");
    return null;
  }
  return socket.data.userId;
}

export function registerSortingSocketHandlers(io: Server): void {
  io.on("connection", (socket) => {
    socket.on("create_room", (payload?: { gameType?: unknown; userId?: unknown }) => {
      if (payload?.gameType !== "sorting") return;
      const userId = validateSortingAccess(socket, payload as Record<string, unknown>);
      if (!userId) return;
      const room = createSortingRoom(socket.id, userId);
      socket.join(room.roomId);
      socket.emit("room_created", { roomId: room.roomId, code: room.code });
    });

    socket.on("join_room", (payload?: { code?: unknown; gameType?: unknown; userId?: unknown }) => {
      if (payload?.gameType !== "sorting") return;
      const userId = validateSortingAccess(socket, payload as Record<string, unknown>);
      if (!userId) return;
      const code = typeof payload.code === "string" ? payload.code.trim().toUpperCase() : "";
      if (!code || !/^[A-Z0-9]{6}$/.test(code)) {
        emitRoomError(socket, "Enter a valid 6-character room code.");
        return;
      }
      const room = joinSortingRoom(code, socket.id, userId);
      if (!room) {
        emitRoomError(socket, "Room not found, full, or no longer waiting.");
        return;
      }
      socket.join(room.roomId);
      const host = room.players[0];
      io.to(host.socketId).emit("opponent_joined", {
        roomId: room.roomId,
        gameType: "sorting",
      });
      socket.emit("room_joined", { roomId: room.roomId, gameType: "sorting" });
      startMatch(io, room);
    });

    socket.on("join_queue", (payload?: { gameType?: unknown; userId?: unknown }) => {
      if (payload?.gameType !== "sorting") return;
      const userId = validateSortingAccess(socket, payload as Record<string, unknown>);
      if (!userId) return;
      const opponentId = addToSortingQueue(socket.id);
      if (!opponentId) {
        socket.emit("queue_joined");
        return;
      }
      const opponentSocket = io.sockets.sockets.get(opponentId);
      const opponentUserId = opponentSocket?.data.userId;
      if (!opponentSocket || typeof opponentUserId !== "string" || !opponentUserId) {
        emitRoomError(socket, "The queued opponent is no longer available. Please try again.");
        return;
      }
      const room = createRandomSortingRoom([opponentId, socket.id], [opponentUserId, userId]);
      opponentSocket.join(room.roomId);
      socket.join(room.roomId);
      io.to(room.roomId).emit("matched", { roomId: room.roomId, gameType: "sorting" });
      startMatch(io, room);
    });

    socket.on("leave_queue", () => removeFromQueue(socket.id));

    socket.on("cancel_room", (payload: { roomId?: string }) => {
      const room = getRoomById(payload?.roomId ?? "") ?? getRoomBySocket(socket.id);
      if (!room || room.status !== "waiting" || room.players[0].socketId !== socket.id) return;
      socket.leave(room.roomId);
      removeRoom(room.roomId);
    });

    socket.on("join_match", (payload: { roomId?: string }) => {
      const room = getRoomById(payload?.roomId ?? "");
      if (!room || !getPlayer(room, socket.id)) {
        emitRoomError(socket, "This match is no longer available. Create or join a new room.");
        return;
      }
      socket.join(room.roomId);
      socket.emit("sorting_room_joined", {
        roomId: room.roomId,
        status: room.status,
      });
      if (room.status === "active") {
        socket.emit("sorting_round_state", publicRound(room, socket.id));
      }
    });

    socket.on("request_sorting_state", () => {
      const room = getRoomBySocket(socket.id);
      if (room?.status === "active") {
        socket.emit("sorting_round_state", publicRound(room, socket.id));
      }
    });

    socket.on("submit_sorting_step", (payload: { answer?: unknown; stepIndex?: unknown }) => {
      const room = getRoomBySocket(socket.id);
      const player = room && getPlayer(room, socket.id);
      const round = room?.currentRound;
      if (!room || room.status !== "active" || !player || !round || player.completedRound) return;

      const stepIndex = player.stepIndex;
      if (
        typeof payload?.stepIndex !== "number" ||
        !Number.isSafeInteger(payload.stepIndex) ||
        payload.stepIndex !== stepIndex
      ) {
        socket.emit("sorting_step_result", {
          correct: false,
          stale: true,
          ...publicRound(room, socket.id),
        });
        return;
      }

      const step = round.steps[stepIndex];
      if (!step || payload.answer === undefined) {
        socket.emit("sorting_step_result", {
          correct: false,
          ...publicRound(room, socket.id),
        });
        return;
      }
      player.attempts += 1;
      const correct =
        typeof payload.answer === typeof step.answer && payload.answer === step.answer;

      if (correct) {
        player.correctActions += 1;
        const nextStepIndex = stepIndex + 1;
        const roundCompleted = nextStepIndex >= round.steps.length;
        for (const roomPlayer of room.players) {
          roomPlayer.stepIndex = nextStepIndex;
          roomPlayer.completedRound = roundCompleted;
          if (roundCompleted) {
            roomPlayer.roundsCompleted += 1;
            roomPlayer.score += 10;
          }
        }
      }

      socket.emit("sorting_step_result", {
        correct,
        ...publicRound(room, socket.id),
      });
      if (correct) {
        io.to(room.roomId).emit("sorting_round_state", publicRound(room, socket.id));
      }

      const opponent = getOpponent(room, socket.id);
      if (opponent) {
        io.to(opponent.socketId).emit("opponent_progress", {
          roomId: room.roomId,
          score: player.score,
          roundsCompleted: player.roundsCompleted,
          round: room.round,
          stepIndex: player.stepIndex,
          totalSteps: round.steps.length,
        });
      }

      if (room.players.every((roomPlayer) => roomPlayer.completedRound)) {
        room.roundAdvanceTimer = setTimeout(() => {
          if (
            getRoomById(room.roomId) === room &&
            room.status === "active" &&
            room.currentRound === round &&
            room.players.every((roomPlayer) => roomPlayer.completedRound)
          ) {
            advanceRound(io, room);
          }
        }, 600);
      }
    });

    socket.on("leave_match", () => {
      const room = removeSocketFromRoom(socket.id);
      if (!room) return;
      const opponent = getOpponent(room, socket.id);
      if (opponent) {
        io.to(opponent.socketId).emit("opponent_left");
        removeRoom(room.roomId);
      }
    });

    socket.on("disconnect", () => {
      removeFromQueue(socket.id);
      const room = getRoomBySocket(socket.id);
      if (!room) return;
      if (room.status === "waiting") {
        removeRoom(room.roomId);
        return;
      }
      const opponent = getOpponent(room, socket.id);
      if (opponent) io.to(opponent.socketId).emit("opponent_left");
      removeRoom(room.roomId);
    });
  });
}
