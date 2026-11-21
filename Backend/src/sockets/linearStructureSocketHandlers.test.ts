import test, { mock } from "node:test";
import assert from "node:assert/strict";
import User from "../models/User";
import { getRoomBySocket, removeRoom } from "./roomManager";
import { registerSocketHandlers } from "./socketHandlers";

type Handler = (payload?: unknown) => void | Promise<void>;

interface TestSocket {
  id: string;
  data: Record<string, unknown>;
  handlers: Map<string, Handler>;
  events: Array<{ name: string; payload: any }>;
  on(event: string, handler: Handler): TestSocket;
  emit(event: string, payload?: any): void;
  join(roomId: string): void;
  leave(roomId: string): void;
}

function createHarness() {
  process.env.JWT_SECRET ??= "test-secret";
  const sockets = new Map<string, TestSocket>();
  const roomEvents: Array<{ roomId: string; name: string; payload: any }> = [];
  let connectionHandler: ((socket: TestSocket) => void) | undefined;

  const io = {
    sockets: { sockets },
    use() { return this; },
    on(event: string, handler: (socket: TestSocket) => void) {
      if (event === "connection") connectionHandler = handler;
      return this;
    },
    to(roomId: string) {
      return {
        emit(name: string, payload: any) {
          roomEvents.push({ roomId, name, payload });
        },
      };
    },
  };
  registerSocketHandlers(io as never);

  function connect(id: string): TestSocket {
    const socket: TestSocket = {
      id,
      data: { userId: `user-${id}`, isGuest: false },
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

  async function send(socket: TestSocket, event: string, payload?: unknown): Promise<void> {
    const handler = socket.handlers.get(event);
    assert.ok(handler, `Expected a handler for ${event}`);
    await handler(payload);
  }

  return { connect, send, roomEvents };
}

function latestPayload<T>(socket: TestSocket, eventName: string): T {
  const event = [...socket.events].reverse().find((entry) => entry.name === eventName);
  assert.ok(event, `Expected ${eventName} event`);
  return event.payload as T;
}

test("FIFO and LIFO matches share moves and advance both players to harder rounds", async () => {
  const userLookup = mock.method(
    User,
    "findById",
    async () => ({ username: "Test player" }) as never
  );
  const { connect, send, roomEvents } = createHarness();

  try {
    for (const gameType of ["fifo", "lifo"] as const) {
      const first = connect(`${gameType}-first`);
      const second = connect(`${gameType}-second`);
      await send(first, "create_room", { gameType });
      const room = getRoomBySocket(first.id);
      assert.ok(room);
      const invite = latestPayload<{ code: string }>(first, "room_created");
      await send(second, "join_room", { gameType, code: invite.code });
      assert.equal(room.status, "active");

      let state = latestPayload<{
          round: number;
          stepIndex: number;
          totalSteps: number;
          items: Array<{ id: number; value: number }>;
          step: { type: "add" | "remove" };
        }>(first, "linear_round_state");
      const secondInitialState = latestPayload<typeof state>(second, "linear_round_state");
      assert.deepEqual(secondInitialState.items, state.items);

      while (state.stepIndex < state.totalSteps) {
          const submittedIndex = state.stepIndex;
          const itemId = state.step.type === "remove"
            ? gameType === "fifo" ? state.items[0]?.id : state.items[state.items.length - 1]?.id
            : undefined;
          const actor = submittedIndex % 2 === 0 ? first : second;
          const opponent = actor === first ? second : first;
          await send(actor, "submit_linear_step", {
            stepIndex: submittedIndex,
            ...(itemId === undefined ? {} : { itemId }),
          });
          const resultEvent = [...roomEvents].reverse().find(
            (event) => event.name === "linear_step_result"
          );
          assert.ok(resultEvent);
          const result = resultEvent.payload as typeof state & {
            correct: boolean;
            completed: boolean;
          };
          assert.equal(result.correct, true);
          assert.equal(result.completed, submittedIndex + 1 === state.totalSteps);

          if (!result.completed) {
            assert.equal(room.players[0].linearStepIndex, result.stepIndex);
            assert.deepEqual(room.players[0].linearItems, result.items);
            assert.equal(room.players[1].linearStepIndex, result.stepIndex);
            assert.deepEqual(room.players[1].linearItems, result.items);
            await send(opponent, "submit_linear_step", {
              stepIndex: submittedIndex,
              ...(itemId === undefined ? {} : { itemId }),
            });
            const syncedState = latestPayload<typeof state>(
              opponent,
              "linear_round_state"
            );
            assert.equal(syncedState.stepIndex, result.stepIndex);
            assert.deepEqual(syncedState.items, result.items);
          }

          state = {
            ...state,
            round: result.round,
            stepIndex: result.stepIndex,
            items: result.items,
            step: result.step,
          };
      }

      const firstNext = latestPayload<{ round: number; totalSteps: number }>(
        first,
        "linear_round_state"
      );
      const secondNext = latestPayload<{ round: number; totalSteps: number }>(
        second,
        "linear_round_state"
      );
      assert.equal(firstNext.round, 2);
      assert.equal(secondNext.round, 2);
      assert.equal(firstNext.totalSteps, 10);
      assert.equal(secondNext.totalSteps, 10);

      removeRoom(room.roomId);
    }
  } finally {
    userLookup.mock.restore();
  }
});
