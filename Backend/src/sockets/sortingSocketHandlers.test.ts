import test from "node:test";
import assert from "node:assert/strict";
import { getRoomBySocket, removeFromQueue, removeRoom } from "./sortingRoomManager";
import { registerSortingSocketHandlers } from "./sortingSocketHandlers";

type SocketHandler = (payload?: unknown) => void;

interface TestSocket {
  id: string;
  data: Record<string, unknown>;
  handlers: Map<string, SocketHandler>;
  events: Array<{ name: string; payload: unknown }>;
  on(event: string, handler: SocketHandler): TestSocket;
  emit(event: string, payload?: unknown): void;
  join(roomId: string): void;
  leave(roomId: string): void;
}

function createHarness() {
  const sockets = new Map<string, TestSocket>();
  const roomEvents: Array<{ roomId: string; name: string; payload: unknown }> = [];
  let connectionHandler: ((socket: TestSocket) => void) | undefined;

  const io = {
    sockets: { sockets },
    on(event: string, handler: (socket: TestSocket) => void) {
      if (event === "connection") connectionHandler = handler;
      return this;
    },
    to(roomId: string) {
      return {
        emit(name: string, payload: unknown) {
          roomEvents.push({ roomId, name, payload });
        },
      };
    },
  };

  registerSortingSocketHandlers(
    io as unknown as Parameters<typeof registerSortingSocketHandlers>[0]
  );

  function connect(id: string, userId?: string): TestSocket {
    const socket: TestSocket = {
      id,
      data: userId ? { isGuest: false, userId } : { isGuest: true },
      handlers: new Map(),
      events: [],
      on(event, handler) {
        this.handlers.set(event, handler);
        return this;
      },
      emit(name, payload) {
        this.events.push({ name, payload });
      },
      join() {},
      leave() {},
    };
    sockets.set(id, socket);
    connectionHandler?.(socket);
    return socket;
  }

  function send(socket: TestSocket, event: string, payload?: unknown): void {
    const handler = socket.handlers.get(event);
    assert.ok(handler, `Expected a handler for ${event}`);
    handler(payload);
  }

  return { connect, send, roomEvents };
}

function sortingErrors(socket: TestSocket) {
  return socket.events.filter((event) => event.name === "sorting_room_error");
}

test("guest sockets are rejected consistently from Sorting room and queue events", () => {
  const { connect, send } = createHarness();
  const guest = connect("sorting-guest");

  send(guest, "create_room", { gameType: "sorting" });
  send(guest, "join_room", { gameType: "sorting", code: "ABC123" });
  send(guest, "join_queue", { gameType: "sorting" });

  const errors = sortingErrors(guest);
  assert.equal(errors.length, 3);
  assert.deepEqual(errors.map((event) => event.payload), Array(3).fill({
    message: "Guests cannot access Sorting multiplayer.",
  }));
  assert.equal(getRoomBySocket(guest.id), undefined);

  const authenticatedPlayer = connect("sorting-authenticated", "trusted-user");
  send(authenticatedPlayer, "join_queue", { gameType: "sorting" });
  assert.ok(authenticatedPlayer.events.some((event) => event.name === "queue_joined"));
  removeFromQueue(authenticatedPlayer.id);
});

test("authenticated Sorting players use socket identity and can create, join, and queue", () => {
  const { connect, send, roomEvents } = createHarness();
  const host = connect("sorting-host", "trusted-host");

  send(host, "create_room", { gameType: "sorting", userId: "forged-user" });
  assert.equal(getRoomBySocket(host.id), undefined);
  assert.equal(sortingErrors(host).length, 1);

  send(host, "create_room", { gameType: "sorting", userId: "trusted-host" });
  const waitingRoom = getRoomBySocket(host.id);
  assert.ok(waitingRoom);
  assert.equal(waitingRoom.players[0].userId, "trusted-host");
  assert.equal(host.events.filter((event) => event.name === "room_created").length, 1);

  const guest = connect("sorting-guest-join");
  send(guest, "join_room", { gameType: "sorting", code: waitingRoom.code });
  assert.equal(getRoomBySocket(guest.id), undefined);
  assert.equal(waitingRoom.players.length, 1);

  const joiner = connect("sorting-joiner", "trusted-joiner");
  send(joiner, "join_room", { gameType: "sorting", code: waitingRoom.code });
  assert.equal(getRoomBySocket(joiner.id)?.roomId, waitingRoom.roomId);
  assert.equal(waitingRoom.players.length, 2);
  assert.equal(waitingRoom.players[1].userId, "trusted-joiner");
  assert.ok(joiner.events.some((event) => event.name === "room_joined"));

  const queuePlayerOne = connect("sorting-queue-one", "trusted-one");
  const queuePlayerTwo = connect("sorting-queue-two", "trusted-two");
  send(queuePlayerOne, "join_queue", { gameType: "sorting" });
  send(queuePlayerTwo, "join_queue", { gameType: "sorting" });
  const queuedRoom = getRoomBySocket(queuePlayerOne.id);
  assert.ok(queuedRoom);
  assert.equal(getRoomBySocket(queuePlayerTwo.id)?.roomId, queuedRoom.roomId);
  assert.deepEqual(
    queuedRoom.players.map((player) => player.userId),
    ["trusted-one", "trusted-two"]
  );
  assert.ok(
    roomEvents.some((event) => event.name === "matched" && event.roomId === queuedRoom.roomId)
  );

  removeRoom(waitingRoom.roomId);
  removeRoom(queuedRoom.roomId);
  removeFromQueue(host.id);
  removeFromQueue(guest.id);
  removeFromQueue(joiner.id);
  removeFromQueue(queuePlayerOne.id);
  removeFromQueue(queuePlayerTwo.id);
});

test("sorting moves update one shared board and reject stale moves", () => {
  const { connect, send, roomEvents } = createHarness();
  const first = connect("sorting-shared-first", "trusted-first");
  const second = connect("sorting-shared-second", "trusted-second");

  send(first, "create_room", { gameType: "sorting" });
  const room = getRoomBySocket(first.id);
  assert.ok(room);
  send(second, "join_room", { gameType: "sorting", code: room.code });
  assert.ok(room.currentRound);

  send(first, "request_sorting_state");
  const initialStateEvent = first.events
    .filter((event) => event.name === "sorting_round_state")
    .pop();
  assert.ok(initialStateEvent);
  const initialState = initialStateEvent.payload as { stepIndex: number; totalSteps: number };
  assert.equal(initialState.stepIndex, 0);

  const answer = room.currentRound.steps[0].answer;
  send(first, "submit_sorting_step", { answer, stepIndex: 0 });

  const sharedStateEvent = roomEvents
    .filter((event) => event.name === "sorting_round_state")
    .pop();
  assert.ok(sharedStateEvent);
  const sharedState = sharedStateEvent.payload as { stepIndex: number };
  assert.equal(sharedState.stepIndex, 1);
  assert.equal(room.players[0].stepIndex, 1);
  assert.equal(room.players[1].stepIndex, 1);

  send(second, "submit_sorting_step", { answer, stepIndex: 0 });
  const staleResultEvent = second.events
    .filter((event) => event.name === "sorting_step_result")
    .pop();
  assert.ok(staleResultEvent);
  const staleResult = staleResultEvent.payload as { correct: boolean; stepIndex: number };
  assert.equal(staleResult.correct, false);
  assert.equal(staleResult.stepIndex, 1);
  assert.equal(room.players[0].stepIndex, 1);
  assert.equal(room.players[1].stepIndex, 1);

  const secondAnswer = room.currentRound.steps[1].answer;
  send(second, "submit_sorting_step", { answer: secondAnswer, stepIndex: 1 });
  const nextSharedStateEvent = roomEvents
    .filter((event) => event.name === "sorting_round_state")
    .pop();
  assert.ok(nextSharedStateEvent);
  assert.equal(
    (nextSharedStateEvent.payload as { stepIndex: number }).stepIndex,
    2
  );
  assert.equal(room.players[0].stepIndex, 2);
  assert.equal(room.players[1].stepIndex, 2);

  removeRoom(room.roomId);
});
