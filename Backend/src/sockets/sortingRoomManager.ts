import { randomUUID } from "crypto";
import type { SortRound } from "../utils/sortingEngine";

export interface SortingPlayer {
  socketId: string;
  score: number;
  roundsCompleted: number;
  attempts: number;
  correctActions: number;
  stepIndex: number;
  completedRound: boolean;
}

export interface SortingRoom {
  roomId: string;
  code: string;
  status: "waiting" | "active";
  round: number;
  players: SortingPlayer[];
  currentRound: SortRound | null;
  endTimer?: ReturnType<typeof setTimeout>;
}

const rooms = new Map<string, SortingRoom>();
const roomByCode = new Map<string, string>();
const roomBySocket = new Map<string, string>();
const randomQueue: string[] = [];
const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  let code = "";
  do {
    code = Array.from({ length: 6 }, () =>
      ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]
    ).join("");
  } while (roomByCode.has(code));
  return code;
}

function createRoom(firstSocketId: string, secondSocketId?: string): SortingRoom {
  const room: SortingRoom = {
    roomId: randomUUID(),
    code: generateCode(),
    status: secondSocketId ? "active" : "waiting",
    round: 0,
    players: [firstSocketId, secondSocketId]
      .filter((socketId): socketId is string => Boolean(socketId))
      .map((socketId) => ({
        socketId,
        score: 0,
        roundsCompleted: 0,
        attempts: 0,
        correctActions: 0,
        stepIndex: 0,
        completedRound: false,
      })),
    currentRound: null,
  };
  rooms.set(room.roomId, room);
  roomByCode.set(room.code, room.roomId);
  for (const player of room.players) roomBySocket.set(player.socketId, room.roomId);
  return room;
}

export function createSortingRoom(socketId: string): SortingRoom {
  removeFromQueue(socketId);
  removeSocketFromRoom(socketId);
  return createRoom(socketId);
}

export function joinSortingRoom(code: string, socketId: string): SortingRoom | null {
  const roomId = roomByCode.get(code.toUpperCase());
  const room = roomId ? rooms.get(roomId) : undefined;
  if (!room || room.status !== "waiting" || room.players.length !== 1) return null;
  if (room.players[0].socketId === socketId) return null;
  removeFromQueue(socketId);
  removeSocketFromRoom(socketId);
  room.players.push({
    socketId,
    score: 0,
    roundsCompleted: 0,
    attempts: 0,
    correctActions: 0,
    stepIndex: 0,
    completedRound: false,
  });
  room.status = "active";
  roomBySocket.set(socketId, room.roomId);
  return room;
}

export function createRandomSortingRoom(socketIds: [string, string]): SortingRoom {
  removeFromQueue(socketIds[0]);
  removeFromQueue(socketIds[1]);
  return createRoom(socketIds[0], socketIds[1]);
}

export function addToSortingQueue(socketId: string): string | null {
  if (randomQueue.includes(socketId)) return null;
  const opponentId = randomQueue.shift();
  if (!opponentId) {
    randomQueue.push(socketId);
    return null;
  }
  return opponentId;
}

export function removeFromQueue(socketId: string): void {
  const index = randomQueue.indexOf(socketId);
  if (index >= 0) randomQueue.splice(index, 1);
}

export function getRoomBySocket(socketId: string): SortingRoom | undefined {
  const roomId = roomBySocket.get(socketId);
  return roomId ? rooms.get(roomId) : undefined;
}

export function getRoomById(roomId: string): SortingRoom | undefined {
  return rooms.get(roomId);
}

export function getPlayer(room: SortingRoom, socketId: string): SortingPlayer | undefined {
  return room.players.find((player) => player.socketId === socketId);
}

export function getOpponent(room: SortingRoom, socketId: string): SortingPlayer | undefined {
  return room.players.find((player) => player.socketId !== socketId);
}

export function removeRoom(roomId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;
  if (room.endTimer) clearTimeout(room.endTimer);
  roomByCode.delete(room.code);
  for (const player of room.players) roomBySocket.delete(player.socketId);
  rooms.delete(roomId);
}

export function removeSocketFromRoom(socketId: string): SortingRoom | undefined {
  const room = getRoomBySocket(socketId);
  if (!room) return undefined;
  roomBySocket.delete(socketId);
  if (room.status === "waiting") {
    removeRoom(room.roomId);
    return room;
  }
  return room;
}
