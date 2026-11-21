import test from "node:test";
import assert from "node:assert/strict";
import {
  applyLinearOperation,
  generateLinearRound,
} from "./linearStructureEngine";

test("FIFO removes the oldest item while LIFO removes the newest item", () => {
  const items = [
    { id: 1, value: 12 },
    { id: 2, value: 34 },
    { id: 3, value: 56 },
  ];

  const fifo = applyLinearOperation("fifo", items, { type: "remove" }, 1);
  const lifo = applyLinearOperation("lifo", items, { type: "remove" }, 3);

  assert.equal(fifo.correct, true);
  assert.deepEqual(fifo.items.map((item) => item.id), [2, 3]);
  assert.equal(lifo.correct, true);
  assert.deepEqual(lifo.items.map((item) => item.id), [1, 2]);
  assert.equal(applyLinearOperation("fifo", items, { type: "remove" }, 3).correct, false);
  assert.equal(applyLinearOperation("lifo", items, { type: "remove" }, 1).correct, false);
});

test("generated rounds become harder and finish without underflow", () => {
  for (const gameType of ["fifo", "lifo"] as const) {
    const first = generateLinearRound(gameType, 1);
    const harder = generateLinearRound(gameType, 5);
    assert.ok(harder.initialItems.length > first.initialItems.length);
    assert.ok(harder.operations.length > first.operations.length);

    for (const challenge of [first, harder]) {
      let items = challenge.initialItems;
      for (const operation of challenge.operations) {
        if (operation.type === "add") {
          assert.ok(operation.item);
          const result = applyLinearOperation(gameType, items, operation);
          assert.equal(result.correct, true);
          items = result.items;
        } else {
          assert.ok(items.length > 0, "challenge must never remove from an empty structure");
          const next = gameType === "fifo" ? items[0] : items[items.length - 1];
          const result = applyLinearOperation(gameType, items, operation, next.id);
          assert.equal(result.correct, true);
          items = result.items;
        }
      }
      assert.deepEqual(items, [], "challenge should end with an empty structure");
    }
  }
});

test("add actions use only the server-prescribed item", () => {
  const items = [{ id: 1, value: 20 }];
  const operation = { type: "add" as const, item: { id: 2, value: 42 } };

  assert.deepEqual(applyLinearOperation("fifo", items, operation), {
    correct: true,
    items: [...items, operation.item],
  });
  assert.equal(applyLinearOperation("lifo", items, operation, 2).correct, false);
});
