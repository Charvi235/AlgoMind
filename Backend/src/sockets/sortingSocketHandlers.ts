import type { Server, Socket } from "socket.io";
import { algoForRound, generateSortRound, publicSortStep } from "../utils/sortingEngine";
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

const MATCH_SECONDS = 120;

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
  room.currentRound = generateSortRound(room.round);
  io.to(room.roomId).emit("sorting_match_start", {
    roomId: room.roomId,
    round: room.round,
    algo: room.currentRound.algo,
    totalSteps: room.currentRound.steps.length,
    seconds: MATCH_SECONDS,
  });
  room.endTimer = setTimeout(() => endMatch(io, room), MATCH_SECONDS * 1000);
}

function advanceRound(io: Server, room: SortingRoom): void {
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

function endMatch(io: Server, room: SortingRoom): void {
  const players = room.players.map((player) => ({
    socketId: player.socketId,
    roundsCompleted: player.roundsCompleted,
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
}

function emitRoomError(socket: Socket, message: string): void {
  socket.emit("sorting_room_error", { message });
}

export function registerSortingSocketHandlers(io: Server): void {
  io.on("connection", (socket) => {
    socket.on("create_room", (payload: { gameType?: string }) => {
      if (payload?.gameType !== "sorting") return;
      const room = createSortingRoom(socket.id);
      socket.join(room.roomId);
      socket.emit("room_created", { roomId: room.roomId, code: room.code });
    });

    socket.on("join_room", (payload: { code?: string; gameType?: string }) => {
      if (payload?.gameType !== "sorting") return;
      const code = payload?.code?.trim().toUpperCase();
      if (!code || !/^[A-Z0-9]{6}$/.test(code)) {
        emitRoomError(socket, "Enter a valid 6-character room code.");
        return;
      }
      const room = joinSortingRoom(code, socket.id);
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

    socket.on("join_queue", (payload: { gameType?: string }) => {
      if (payload?.gameType !== "sorting") return;
      const opponentId = addToSortingQueue(socket.id);
      if (!opponentId) {
        socket.emit("queue_joined");
        return;
      }
      const room = createRandomSortingRoom([opponentId, socket.id]);
      const opponentSocket = io.sockets.sockets.get(opponentId);
      opponentSocket?.join(room.roomId);
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

    socket.on("submit_sorting_step", (payload: { answer?: unknown }) => {
      const room = getRoomBySocket(socket.id);
      const player = room && getPlayer(room, socket.id);
      const round = room?.currentRound;
      if (!room || room.status !== "active" || !player || !round || player.completedRound) return;

      const step = round.steps[player.stepIndex];
      if (!step || payload?.answer === undefined) return;
      player.attempts += 1;
      const correct =
        typeof payload.answer === typeof step.answer && payload.answer === step.answer;

      if (correct) {
        player.correctActions += 1;
        player.stepIndex += 1;
        if (player.stepIndex >= round.steps.length) {
          player.completedRound = true;
          player.roundsCompleted += 1;
          player.score += 10;
        }
      }

      socket.emit("sorting_step_result", {
        correct,
        ...publicRound(room, socket.id),
      });

      const opponent = getOpponent(room, socket.id);
      if (opponent) {
        io.to(opponent.socketId).emit("opponent_progress", {
          score: player.score,
          roundsCompleted: player.roundsCompleted,
        });
      }

      if (room.players.every((roomPlayer) => roomPlayer.completedRound)) {
        advanceRound(io, room);
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
