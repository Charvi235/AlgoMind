export type LinearGameType = "fifo" | "lifo";
export type LinearOperationType = "add" | "remove";

export interface LinearItem {
  id: number;
  value: number;
}

export interface LinearOperation {
  type: LinearOperationType;
  item?: LinearItem;
}

export interface LinearRound {
  gameType: LinearGameType;
  round: number;
  initialItems: LinearItem[];
  operations: LinearOperation[];
}

export function isLinearGameType(value: unknown): value is LinearGameType {
  return value === "fifo" || value === "lifo";
}

function randomValue(): number {
  return Math.floor(Math.random() * 90) + 10;
}

export function generateLinearRound(gameType: LinearGameType, round: number): LinearRound {
  const initialCount = 2 + Math.min(Math.floor((round - 1) / 2), 3);
  const operationCount = Math.min(8 + (round - 1) * 2, 30);
  const initialItems = Array.from({ length: initialCount }, (_, index) => ({
    id: index + 1,
    value: randomValue(),
  }));
  const operations: LinearOperation[] = [];
  let structureSize = initialCount;
  let nextItemId = initialCount + 1;

  for (let index = 0; index < operationCount; index += 1) {
    const remainingSteps = operationCount - index - 1;
    const shouldAdd =
      structureSize === 0 ||
      (structureSize < remainingSteps && Math.random() < 0.58);

    if (shouldAdd) {
      operations.push({ type: "add", item: { id: nextItemId++, value: randomValue() } });
      structureSize += 1;
    } else {
      operations.push({ type: "remove" });
      structureSize -= 1;
    }
  }

  return { gameType, round, initialItems, operations };
}

export function applyLinearOperation(
  gameType: LinearGameType,
  items: LinearItem[],
  operation: LinearOperation,
  submittedItemId?: number
): { correct: boolean; items: LinearItem[] } {
  if (operation.type === "add") {
    if (!operation.item || submittedItemId !== undefined) {
      return { correct: false, items };
    }
    return { correct: true, items: [...items, operation.item] };
  }

  if (submittedItemId === undefined || items.length === 0) {
    return { correct: false, items };
  }

  const expectedIndex = gameType === "fifo" ? 0 : items.length - 1;
  if (items[expectedIndex]?.id !== submittedItemId) {
    return { correct: false, items };
  }

  return {
    correct: true,
    items: items.filter((_, index) => index !== expectedIndex),
  };
}

export function publicLinearOperation(operation: LinearOperation) {
  return operation.type === "add"
    ? { type: operation.type, item: operation.item }
    : { type: operation.type };
}
