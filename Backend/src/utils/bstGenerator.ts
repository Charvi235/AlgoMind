export interface BSTNode {
  value: number;
  left: BSTNode | null;
  right: BSTNode | null;
}

export interface BstInsertionResult {
  valid: boolean;
  parentValue?: number;
  side?: "left" | "right";
}

/**
 * Generates `count` unique random numbers.
 * Picked in a spread step (e.g. multiples of 5) to keep visual layout clear.
 */
export function generateBstQuestion(count = 7): number[] {
  const min = 10;
  const max = 90;
  const step = 5;

  const pool: number[] = [];
  for (let v = min; v <= max; v += step) {
    pool.push(v);
  }

  // Shuffle pool
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const selected = pool.slice(0, count);

  // Guarantee root is non-extreme to prevent degenerate 1-line trees
  const sorted = [...selected].sort((a, b) => a - b);
  const midIndex = Math.floor(count / 2);
  const rootValue = sorted[midIndex];

  // Move chosen root to the front of the array
  const queue = selected.filter((val) => val !== rootValue);
  return [rootValue, ...queue];
}

export function findBstInsertion(tree: BSTNode | null, value: number): BstInsertionResult {
  if (tree === null) {
    return { valid: true };
  }

  let current: BSTNode | null = tree;
  let parent: BSTNode | null = null;

  while (current) {
    if (value === current.value) {
      return { valid: false };
    }

    if (value < current.value) {
      if (current.left === null) {
        return { valid: true, parentValue: current.value, side: "left" };
      }
      parent = current;
      current = current.left;
      continue;
    }

    if (current.right === null) {
      return { valid: true, parentValue: current.value, side: "right" };
    }

    parent = current;
    current = current.right;
  }

  if (parent) {
    return {
      valid: true,
      parentValue: parent.value,
      side: value < parent.value ? "left" : "right",
    };
  }

  return { valid: true };
}

export function insertBstValue(tree: BSTNode | null, value: number): BSTNode | null {
  if (tree === null) {
    return { value, left: null, right: null };
  }

  if (value === tree.value) {
    return null;
  }

  if (value < tree.value) {
    if (tree.left === null) {
      tree.left = { value, left: null, right: null };
      return tree;
    }
    const result = insertBstValue(tree.left, value);
    if (result) {
      tree.left = result;
    }
    return tree;
  }

  if (tree.right === null) {
    tree.right = { value, left: null, right: null };
    return tree;
  }

  const result = insertBstValue(tree.right, value);
  if (result) {
    tree.right = result;
  }
  return tree;
}

/**
 * Validates whether inserting `value` into `parentValue` on `side`
 * respects all Binary Search Tree invariants.
 */
export function validateBstPlacement(
  tree: BSTNode | null,
  parentValue: number,
  side: "left" | "right",
  value: number
): boolean {
  const insertion = findBstInsertion(tree, value);
  if (!insertion.valid) return false;
  if (insertion.parentValue === undefined) {
    return tree === null && value === parentValue;
  }
  return insertion.parentValue === parentValue && insertion.side === side;
}