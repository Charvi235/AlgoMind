import test from "node:test";
import assert from "node:assert/strict";
import { resolveBstFinalOutcome } from "./bstController";

const numbers = [50, 30, 70, 20, 40, 60, 80];
const deadline = new Date("2026-10-28T12:00:00.000Z");

test("BST completed round receives its existing 60-point maximum", () => {
  const result = resolveBstFinalOutcome(numbers, deadline, true, 6, deadline.getTime() - 1);
  assert.deepEqual(result, { validCompletion: true, score: 60, expired: false });
});

test("BST incomplete rounds always finalize with zero", () => {
  for (const placedCount of [0, 3, 5]) {
    const result = resolveBstFinalOutcome(numbers, deadline, false, placedCount, deadline.getTime());
    assert.equal(result.validCompletion, false);
    assert.equal(result.score, 0);
    assert.equal(result.expired, true);
  }
});

test("BST completion at or after the deadline cannot earn points", () => {
  const atDeadline = resolveBstFinalOutcome(numbers, deadline, true, 6, deadline.getTime());
  const afterDeadline = resolveBstFinalOutcome(numbers, deadline, true, 6, deadline.getTime() + 1);
  assert.equal(atDeadline.validCompletion, false);
  assert.equal(afterDeadline.validCompletion, false);
  assert.equal(afterDeadline.score, 0);
});

test("BST submission requires every placement", () => {
  const result = resolveBstFinalOutcome(numbers, deadline, true, 5, deadline.getTime() - 1);
  assert.equal(result.validCompletion, false);
  assert.equal(result.score, 0);
});
