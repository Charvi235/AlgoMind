/**
 * roomManager.ts
 *
 * Generic, in-memory room + matchmaking store. Works for ANY gameType
 * — no Dijkstra-specific logic here. Game-specific round generation
 * and validation lives in socketHandlers.ts, keyed by gameType.
 */

import { randomUUID } from "crypto";

export interface Player {
  socketId: string;
  userId?: string;      // undefined = guest, not saved to DB
  username?: string;
  score: number;
  correctCount: number;
  totalActions: number;
  attempts: number; // every submit_step, correct or not — used for accuracy
}

export interface Room {
  roomId: string;
  gameType: string;
  code: string;
  players: Player[];
  status: "waiting" | "active" | "finished";
  round: number;
  currentRoundData: unknown;
  matchEndTimer: NodeJS.Timeout | null;
}

interface QueuedPlayer {
  socketId: string;
  userId?: string;
  username?: string;
}

const rooms = new Map<string, Room>();
const codeToRoomId = new Map<string, string>();
const randomQueues = new Map<string, QueuedPlayer[]>(); // gameType -> waiting players
const socketToRoomId = new Map<string, string>();

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars (0/O, 1/I)
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function newPlayer(socketId: string, userId?: string, username?: string): Player {
  return { socketId, userId, username, score: 0, correctCount: 0, totalActions: 0, attempts: 0 };
}

export function createRoom(
  gameType: string,
  hostSocketId: string,
  userId?: string,
  username?: string
): Room {
  const roomId = randomUUID();
  let code = generateCode();
  while (codeToRoomId.has(code)) code = generateCode(); // avoid rare collision

  const room: Room = {
    roomId,
    gameType,
    code,
    players: [newPlayer(hostSocketId, userId, username)],
    status: "waiting",
    round: 0,
    currentRoundData: null,
    matchEndTimer: null,
  };
  rooms.set(roomId, room);
  codeToRoomId.set(code, roomId);
  socketToRoomId.set(hostSocketId, roomId);
  return room;
}

export function joinRoomByCode(
  code: string,
  socketId: string,
  userId?: string,
  username?: string
): Room | null {
  const roomId = codeToRoomId.get(code.toUpperCase());
  if (!roomId) return null;
  const room = rooms.get(roomId);
  if (!room || room.status !== "waiting" || room.players.length >= 2) return null;

  room.players.push(newPlayer(socketId, userId, username));
  socketToRoomId.set(socketId, roomId);
  room.status = "active";
  return room;
}

/**
 * Returns a matched Room if someone was already waiting in the queue
 * for this gameType, otherwise queues this socket and returns null.
 */
export function joinRandomQueue(
  gameType: string,
  socketId: string,
  userId?: string,
  username?: string
): Room | null {
  const queue = randomQueues.get(gameType) ?? [];

  if (queue.length > 0) {
    const opponent = queue.shift()!;
    randomQueues.set(gameType, queue);

    const roomId = randomUUID();
    const room: Room = {
      roomId,
      gameType,
      code: generateCode(), // unused for random matches, kept for consistency
      players: [
        newPlayer(opponent.socketId, opponent.userId, opponent.username),
        newPlayer(socketId, userId, username),
      ],
      status: "active",
      round: 0,
      currentRoundData: null,
      matchEndTimer: null,
    };
    rooms.set(roomId, room);
    socketToRoomId.set(opponent.socketId, roomId);
    socketToRoomId.set(socketId, roomId);
    return room;
  }

  queue.push({ socketId, userId, username });
  randomQueues.set(gameType, queue);
  return null;
}

export function leaveQueue(gameType: string, socketId: string): void {
  const queue = randomQueues.get(gameType);
  if (!queue) return;
  randomQueues.set(gameType, queue.filter((p) => p.socketId !== socketId));
}

export function getRoomBySocket(socketId: string): Room | null {
  const roomId = socketToRoomId.get(socketId);
  if (!roomId) return null;
  return rooms.get(roomId) ?? null;
}

export function getOpponent(room: Room, socketId: string): Player | null {
  return room.players.find((p) => p.socketId !== socketId) ?? null;
}

export function getPlayer(room: Room, socketId: string): Player | null {
  return room.players.find((p) => p.socketId === socketId) ?? null;
}

export function removeRoom(roomId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;
  if (room.matchEndTimer) clearTimeout(room.matchEndTimer);
  for (const p of room.players) socketToRoomId.delete(p.socketId);
  codeToRoomId.delete(room.code);
  rooms.delete(roomId);
}

/** Call on disconnect to clean up queue membership + find their active room (if any). */
export function handleDisconnect(socketId: string): Room | null {
  for (const gameType of randomQueues.keys()) leaveQueue(gameType, socketId);
  const room = getRoomBySocket(socketId);
  return room;
}