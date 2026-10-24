import test, { mock } from "node:test";
import assert from "node:assert/strict";

import { authMiddleware } from "../middleware/auth";
import { createRoom, getRoomBySocket, joinRoomByCode, removeRoom, handleDisconnect } from "./roomManager";
import {
  applyBstMove,
  isGuestAllowedGameType,
  registerSocketHandlers,
  resolveSocketAuth,
  sanitizeGuestName,
  validateClientIdentity,
} from "./socketHandlers";

function createMockSocket(id: string, auth: Record<string, unknown>) {
  const handlers = new Map<string, (payload?: any) => void>();
  const socket: any = {
    id,
    handshake: { auth },
    data: {},
    handlers,
    on(event: string, handler: (payload?: any) => void) {
      handlers.set(event, handler);
      return this;
    },
    emit(event: string, payload?: any) {
      const handler = handlers.get(event);
      if (handler) handler(payload);
      return this;
    },
    join() {},
    leave() {},
  };
  return socket;
}

function flushAsyncWork(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function createSocketHarness() {
  process.env.JWT_SECRET ??= "test-secret";
  const emitted: Array<{ roomId: string; eventName: string; payload: any }> = [];
  const server: any = {
    emitted,
    connection: null as null | ((socket: any) => void),
    useHandler: null as null | ((socket: any, next: () => void) => void),
    sockets: { sockets: new Map<string, any>() },
    on(event: string, handler: (socket: any) => void) {
      if (event === "connection") this.connection = handler;
      return this;
    },
    use(handler: (socket: any, next: () => void) => void) {
      this.useHandler = handler;
      return this;
    },
    to(roomId: string) {
      return {
        emit(eventName: string, payload: any) {
          emitted.push({ roomId, eventName, payload });
        },
      };
    },
  };

  registerSocketHandlers(server);
  return server;
}

function attachSocket(server: any, id: string, auth: Record<string, unknown>) {
  const socket = createMockSocket(id, auth);
  server.useHandler(socket, () => undefined);
  server.connection?.(socket);
  server.sockets.sockets.set(socket.id, socket);
  return socket;
}

function createBstTestRoom() {
  const room = createRoom("bst", "host", undefined, "Host");
  if (!room) throw new Error("Failed to create BST test room");

  const guestPlayer = {
    socketId: "guest",
    userId: undefined,
    username: "Guest",
    score: 0,
    correctCount: 0,
    totalActions: 0,
    attempts: 0,
  };
  room.players.push(guestPlayer);
  room.status = "active";
  room.bstState = {
    sequence: [50, 30, 70, 20, 40, 60, 80],
    startedAt: Date.now(),
    endsAt: Date.now() + 120000,
    status: "active",
    timer: null,
    completed: false,
    winnerSocketId: null,
    players: [
      {
        socketId: "host",
        userId: undefined,
        username: "Host",
        tree: { value: 50, left: null, right: null },
        nextExpectedIndex: 1,
        correctCount: 1,
        attempts: 0,
        finished: false,
      },
      {
        socketId: "guest",
        userId: undefined,
        username: "Guest",
        tree: { value: 50, left: null, right: null },
        nextExpectedIndex: 1,
        correctCount: 1,
        attempts: 0,
        finished: false,
      },
    ],
  };
  return room;
}

test("valid JWT user can still connect", () => {
  const result = resolveSocketAuth({ token: "jwt-token" }, "test-secret", () => ({ userId: "user-123" }));
  assert.equal(result.userId, "user-123");
  assert.equal(result.isGuest, false);
  assert.equal(result.error, undefined);
});

test("guest can connect and create a BST room", () => {
  const guest = resolveSocketAuth({ token: "", guest: true, username: "Player One" }, "test-secret");
  assert.equal(guest.isGuest, true);
  assert.equal(guest.guestName, "Player One");

  const room = createRoom("bst", "socket-host", undefined, guest.guestName)!;
  assert.ok(room);
  assert.equal(room.gameType, "bst");
  assert.equal(room.players.length, 1);
  assert.equal(room.code.length, 6);
  assert.equal(room.players[0].username, "Player One");
  assert.equal(room.players[0].userId, undefined);
  removeRoom(room.roomId);
});

test("guest can join a valid waiting BST room", () => {
  const room = createRoom("bst", "host-socket", undefined, "Host")!;
  const joined = joinRoomByCode(room.code, "guest-socket", undefined, "Guest");

  assert.ok(joined);
  assert.equal(joined?.status, "active");
  assert.equal(joined?.players.length, 2);
  assert.equal(joined?.players[1].username, "Guest");
  removeRoom(room.roomId);
});

test("guest cannot create or join unsupported game types", () => {
  assert.equal(isGuestAllowedGameType("bst"), true);
  assert.equal(isGuestAllowedGameType("dijkstra"), false);
  assert.equal(isGuestAllowedGameType("sorting"), false);
});

test("invalid room codes are rejected", () => {
  const room = joinRoomByCode("BAD", "socket-2", undefined, "Guest");
  assert.equal(room, null);
});

test("full, active, and nonexistent rooms cannot be joined", () => {
  const roomOne = createRoom("bst", "host-a", undefined, "Host A")!;
  const roomTwo = joinRoomByCode(roomOne.code, "guest-b", undefined, "Guest B");
  assert.ok(roomTwo);

  const fullJoin = joinRoomByCode(roomOne.code, "third-socket", undefined, "Guest C");
  assert.equal(fullJoin, null);

  const missing = joinRoomByCode("ABC123", "other-socket", undefined, "Guest D");
  assert.equal(missing, null);

  removeRoom(roomOne.roomId);
});

test("player cannot join their own room with a second socket", () => {
  const room = createRoom("bst", "self-host", undefined, "Host")!;
  const selfJoin = joinRoomByCode(room.code, "self-host", undefined, "Host");
  assert.equal(selfJoin, null);
  removeRoom(room.roomId);
});

test("repeated room creation does not leave unwanted duplicate waiting rooms", () => {
  const room = createRoom("bst", "repeat-host", undefined, "Host")!;
  const sameSocketRoom = createRoom("bst", "repeat-host", undefined, "Host")!;
  assert.equal(sameSocketRoom.roomId, room.roomId);
  assert.equal(getRoomBySocket("repeat-host")?.roomId, room.roomId);
  removeRoom(room.roomId);
});

test("guest cannot claim another user's identity", () => {
  const socket = { data: { isGuest: true, userId: undefined } } as any;
  const error = validateClientIdentity(socket, { userId: "user-abc" });
  assert.equal(error, "Guest sockets cannot claim a user ID.");

  const loggedInSocket = { data: { isGuest: false, userId: "real-user" } } as any;
  const mismatch = validateClientIdentity(loggedInSocket, { userId: "other-user" });
  assert.equal(mismatch, "User identity is not accepted from the client payload.");
});

test("Dijkstra room creation and join still works for valid authenticated users", () => {
  const hostRoom = createRoom("dijkstra", "dij-host", "user-1", "Alice")!;
  assert.ok(hostRoom);
  assert.equal(hostRoom.gameType, "dijkstra");

  const joined = joinRoomByCode(hostRoom.code, "dij-guest", "user-2", "Bob");
  assert.ok(joined);
  assert.equal(joined?.players.length, 2);
  removeRoom(hostRoom.roomId);
});

test("REST auth middleware still rejects missing bearer tokens", () => {
  let nextCalled = false;
  const req = { headers: {} } as any;
  const res = {
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json() {
      return this;
    },
  } as any;

  authMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test("disconnect cleanup removes stale room mappings and waiting rooms", () => {
  const room = createRoom("bst", "cleanup-host", undefined, "Host")!;
  assert.ok(getRoomBySocket("cleanup-host"));

  const disconnectedRoom = handleDisconnect("cleanup-host");
  assert.ok(disconnectedRoom);
  assert.equal(disconnectedRoom?.roomId, room.roomId);

  removeRoom(room.roomId);
  assert.equal(getRoomBySocket("cleanup-host"), null);
});

test("sanitizeGuestName strips unsafe characters and rejects empty names", () => {
  assert.equal(sanitizeGuestName(" Guest-1 "), "Guest-1");
  assert.equal(sanitizeGuestName("Bad@Name!"), "BadName");
  assert.equal(sanitizeGuestName("  "), undefined);
  assert.equal(sanitizeGuestName(42 as unknown), undefined);
});

test("BST room start emits a shared sequence and independent player trees", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const server = createSocketHarness();
    const host = attachSocket(server, "host", { guest: true, username: "Host" });
    const guest = attachSocket(server, "guest", { guest: true, username: "Guest" });

    host.emit("create_room", { gameType: "bst" });
    await flushAsyncWork();
    let room = getRoomBySocket("host");
    if (!room) throw new Error("BST room was not created");
    guest.emit("join_room", { code: room.code, gameType: "bst" });
    await flushAsyncWork();
    room = getRoomBySocket("host");
    if (!room) throw new Error("BST room was not joined");

    assert.ok(room.bstState);
    const [hostState, guestState] = room.bstState!.players;
    assert.equal(room.bstState!.sequence.length, 7);
    assert.ok(hostState.tree);
    assert.ok(guestState.tree);
    assert.equal(hostState.tree!.value, room.bstState!.sequence[0]);
    assert.equal(guestState.tree!.value, room.bstState!.sequence[0]);
    assert.notStrictEqual(hostState.tree, guestState.tree);
    assert.equal(hostState.nextExpectedIndex, 1);
    assert.equal(guestState.nextExpectedIndex, 1);
    assert.ok(server.emitted.some((entry: any) => entry.eventName === "bst_match_start"));

    removeRoom(room.roomId);
  } finally {
    mock.timers.reset();
  }
});

test("BST moves validate and reject invalid or duplicate submissions without mutation", () => {
  const server: any = {
    emitted: [],
    sockets: { sockets: new Map<string, any>() },
    on() {},
    use() {},
    to() {
      return { emit() {} };
    },
  };
  const room = createBstTestRoom();
  const hostSocket = { id: "host", emit() {} };
  const guestSocket = { id: "guest", emit() {} };
  server.sockets.sockets.set("host", hostSocket);
  server.sockets.sockets.set("guest", guestSocket);

  assert.ok(room.bstState);
  const hostState = room.bstState!.players[0];
  const guestState = room.bstState!.players[1];

  const valid = applyBstMove(server, room, "host", { value: 30, parentValue: 50, side: "left" });
  assert.equal(valid.valid, true);
  assert.equal(hostState.nextExpectedIndex, 2);
  assert.ok(hostState.tree);
  assert.equal(hostState.tree!.left?.value, 30);
  assert.equal(guestState.tree!.left, null);

  const outOfOrder = applyBstMove(server, room, "host", { value: 20, parentValue: 50, side: "left" });
  assert.equal(outOfOrder.valid, false);
  assert.equal(hostState.nextExpectedIndex, 2);
  assert.equal(hostState.tree!.left?.value, 30);

  const duplicate = applyBstMove(server, room, "host", { value: 30, parentValue: 50, side: "left" });
  assert.equal(duplicate.valid, false);
  assert.equal(hostState.nextExpectedIndex, 2);

  const noRoom = applyBstMove(server, room, "outside", { value: 30, parentValue: 50, side: "left" });
  assert.equal(noRoom.valid, false);
  assert.equal(noRoom.reason, "not_in_room");

  removeRoom(room.roomId);
});

test("BST first-to-finish winner and timeout cleanup are authoritative", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const server = createSocketHarness();
    const host = attachSocket(server, "host", { guest: true, username: "Host" });
    const guest = attachSocket(server, "guest", { guest: true, username: "Guest" });

    host.emit("create_room", { gameType: "bst" });
    await flushAsyncWork();
    let room = getRoomBySocket("host");
    if (!room) throw new Error("BST room was not created");
    guest.emit("join_room", { code: room.code, gameType: "bst" });
    await flushAsyncWork();
    room = getRoomBySocket("host");
    if (!room) throw new Error("BST room was not joined");

    const match = room.bstState!;
    match.sequence = [50, 30];
    match.players[0].nextExpectedIndex = 1;
    match.players[1].nextExpectedIndex = 1;
    match.players[0].tree = { value: 50, left: null, right: null };
    match.players[1].tree = { value: 50, left: null, right: null };

    const winner = applyBstMove(server, room, "host", { value: 30, parentValue: 50, side: "left" });
    assert.equal(winner.valid, true);
    assert.equal(room.bstState!.completed, true);
    assert.equal(room.bstState!.winnerSocketId, "host");
    assert.equal(room.status, "finished");

    const retry = applyBstMove(server, room, "host", { value: 30, parentValue: 50, side: "left" });
    assert.equal(retry.valid, false);
    assert.equal(retry.reason, "match_not_active");

    const timeoutServer = createSocketHarness();
    const timeoutHost = attachSocket(timeoutServer, "timeout-host", { guest: true, username: "Host" });
    const timeoutGuest = attachSocket(timeoutServer, "timeout-guest", { guest: true, username: "Guest" });

    timeoutHost.emit("create_room", { gameType: "bst" });
    await flushAsyncWork();
    let timeoutRoom = getRoomBySocket("timeout-host");
    if (!timeoutRoom) throw new Error("Timeout test room not created");
    timeoutGuest.emit("join_room", { code: timeoutRoom.code, gameType: "bst" });
    await flushAsyncWork();
    timeoutRoom = getRoomBySocket("timeout-host");
    if (!timeoutRoom) throw new Error("Timeout test room not joined");

    timeoutRoom.bstState!.players[0].correctCount = 3;
    timeoutRoom.bstState!.players[0].attempts = 6;
    timeoutRoom.bstState!.players[0].nextExpectedIndex = 3;
    timeoutRoom.bstState!.players[1].correctCount = 2;
    timeoutRoom.bstState!.players[1].attempts = 5;
    timeoutRoom.bstState!.players[1].nextExpectedIndex = 2;

    mock.timers.tick(120000);
    assert.ok(timeoutServer.emitted.some((entry: any) => entry.eventName === "bst_match_end" && entry.payload.reason === "timeout"));
    assert.equal(timeoutServer.emitted.find((entry: any) => entry.eventName === "bst_match_end")?.payload.winnerSocketId, "timeout-host");
    assert.equal(getRoomBySocket("timeout-host"), null);
  } finally {
    mock.timers.reset();
  }
});

test("BST disconnect uses the 15s grace window and finalizes the match cleanly", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const server = createSocketHarness();
    const host = attachSocket(server, "disconnect-host", { guest: true, username: "Host" });
    const guest = attachSocket(server, "disconnect-guest", { guest: true, username: "Guest" });

    host.emit("create_room", { gameType: "bst" });
    await flushAsyncWork();
    let room = getRoomBySocket("disconnect-host");
    if (!room) throw new Error("BST room was not created");
    guest.emit("join_room", { code: room.code, gameType: "bst" });
    await flushAsyncWork();
    room = getRoomBySocket("disconnect-host");
    if (!room) throw new Error("BST room was not joined");

    host.emit("disconnect");
    await flushAsyncWork();
    assert.ok(server.emitted.some((entry: any) => entry.eventName === "opponent_left"));
    mock.timers.tick(15000);
    assert.ok(server.emitted.some((entry: any) => entry.eventName === "bst_match_end" && entry.payload.reason === "disconnect"));
    assert.equal(getRoomBySocket("disconnect-guest"), null);
  } finally {
    mock.timers.reset();
  }
});
