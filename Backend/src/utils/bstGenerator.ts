export interface BSTNode {
  value: number;
  left: BSTNode | null;
  right: BSTNode | null;
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
  return checkNodeBounds(tree, -Infinity, Infinity, parentValue, side, value);
}

function checkNodeBounds(
  node: BSTNode | null,
  minVal: number,
  maxVal: number,
  parentValue: number,
  side: "left" | "right",
  value: number
): boolean {
  if (!node) return false;

  if (node.value === parentValue) {
    if (side === "left") {
      return node.left === null && value > minVal && value < node.value;
    } else {
      return node.right === null && value > node.value && value < maxVal;
    }
  }

  // Recurse left or right updating boundary ranges
  if (node.left && checkNodeBounds(node.left, minVal, node.value, parentValue, side, value)) {
    return true;
  }
  if (node.right && checkNodeBounds(node.right, node.value, maxVal, parentValue, side, value)) {
    return true;
  }

  return false;
}