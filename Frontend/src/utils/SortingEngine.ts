/**
 * sortingEngine.ts
 *
 * Pure (no React / DOM) logic for the "Sorting Showdown" game.
 *
 * The player performs a real sorting algorithm BY HAND, one step at a time.
 * This file simulates the algorithm up-front and records every decision the
 * player must make as a `SortStep`. The board just walks through the steps
 * and checks the player's answer against `step.answer`.
 *
 * Supported algorithms:
 *   bubble     – compare adjacent pair  → Swap / Keep
 *   insertion  – compare key with left neighbour → Swap / Keep
 *   selection  – tap the smallest element of the unsorted section
 *
 * Because everything is precomputed, the same step list can later be
 * generated server-side (so both players in a live match get the SAME array):
 *   TODO: GET /api/games/sorting/round?seed=<roomId>-<round>
 */

export type SortAlgo = "bubble" | "insertion" | "selection";

export interface SortItem {
  /** Stable identity — lets framer-motion animate a swap instead of re-rendering */
  id:    number;
  value: number;
}

export type StepKind = "swap-or-keep" | "pick-min";

export interface SortStep {
  kind: StepKind;
  /** Array state BEFORE the player answers this step */
  arr: SortItem[];
  /** Indices to highlight (the pair being compared) — empty for pick-min */
  focus: number[];
  /** Indices already in their final / sorted position */
  sorted: number[];
  /** pick-min only: inclusive [lo, hi] range the player may choose from */
  range?: [number, number];
  /**
   * swap-or-keep → true  = "Swap",  false = "Keep"
   * pick-min     → the index (in `arr`) of the smallest element in `range`
   */
  answer: boolean | number;
}

export interface SortRound {
  algo:     SortAlgo;
  steps:    SortStep[];
  finalArr: SortItem[];
}

// ─── Metadata (titles / rules shown in the UI) ─────────────────────────────────

export const ALGO_ORDER: SortAlgo[] = ["bubble", "insertion", "selection"];

export const ALGO_INFO: Record<SortAlgo, { title: string; rule: string; complexity: string }> = {
  bubble: {
    title:      "Bubble Sort",
    rule:       "Compare the two glowing bars. If the LEFT bar is taller, swap them — otherwise keep.",
    complexity: "O(n²)",
  },
  insertion: {
    title:      "Insertion Sort",
    rule:       "The right glowing bar is being inserted into the sorted section on its left. If its left neighbour is taller, swap — otherwise keep.",
    complexity: "O(n²)",
  },
  selection: {
    title:      "Selection Sort",
    rule:       "Tap the SHORTEST bar in the unsorted section. It will be swapped to the front of that section.",
    complexity: "O(n²)",
  },
};

// ─── Random array ──────────────────────────────────────────────────────────────

/** Unique values (so "smallest" is never ambiguous) and never already sorted. */
export function randomItems(n = 5, maxValue = 99): SortItem[] {
  const pool = new Set<number>();
  while (pool.size < n) pool.add(1 + Math.floor(Math.random() * maxValue));
  let values = [...pool];

  const isSorted = (a: number[]) => a.every((v, i) => i === 0 || a[i - 1] <= v);
  do {
    // Fisher–Yates
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
  } while (isSorted(values));

  return values.map((value, id) => ({ id, value }));
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const clone = (a: SortItem[]) => a.map((x) => ({ ...x }));

function swap(a: SortItem[], i: number, j: number) {
  [a[i], a[j]] = [a[j], a[i]];
}

const range = (from: number, to: number) => {
  const out: number[] = [];
  for (let k = from; k <= to; k++) out.push(k);
  return out;
};

// ─── Step generators ───────────────────────────────────────────────────────────

function bubbleSteps(input: SortItem[]): { steps: SortStep[]; finalArr: SortItem[] } {
  const a = clone(input);
  const n = a.length;
  const steps: SortStep[] = [];

  for (let pass = 0; pass < n - 1; pass++) {
    for (let i = 0; i < n - 1 - pass; i++) {
      const needSwap = a[i].value > a[i + 1].value;
      steps.push({
        kind:   "swap-or-keep",
        arr:    clone(a),
        focus:  [i, i + 1],
        sorted: range(n - pass, n - 1),   // suffix locked in by previous passes
        answer: needSwap,
      });
      if (needSwap) swap(a, i, i + 1);
    }
  }
  return { steps, finalArr: a };
}

function insertionSteps(input: SortItem[]): { steps: SortStep[]; finalArr: SortItem[] } {
  const a = clone(input);
  const n = a.length;
  const steps: SortStep[] = [];

  for (let i = 1; i < n; i++) {
    let j = i; // current position of the "key" being inserted
    while (j > 0) {
      const needSwap = a[j - 1].value > a[j].value;
      steps.push({
        kind:   "swap-or-keep",
        arr:    clone(a),
        focus:  [j - 1, j],
        sorted: range(0, i).filter((k) => k !== j && k !== j - 1),
        answer: needSwap,
      });
      if (!needSwap) break;
      swap(a, j - 1, j);
      j--;
    }
  }
  return { steps, finalArr: a };
}

function selectionSteps(input: SortItem[]): { steps: SortStep[]; finalArr: SortItem[] } {
  const a = clone(input);
  const n = a.length;
  const steps: SortStep[] = [];

  for (let i = 0; i < n - 1; i++) {
    let minIdx = i;
    for (let k = i + 1; k < n; k++) if (a[k].value < a[minIdx].value) minIdx = k;

    steps.push({
      kind:   "pick-min",
      arr:    clone(a),
      focus:  [],
      sorted: range(0, i - 1),
      range:  [i, n - 1],
      answer: minIdx,
    });
    if (minIdx !== i) swap(a, i, minIdx);
  }
  return { steps, finalArr: a };
}

// ─── Public API ────────────────────────────────────────────────────────────────

export function buildSortRound(algo: SortAlgo, items: SortItem[] = randomItems()): SortRound {
  const { steps, finalArr } =
    algo === "bubble"    ? bubbleSteps(items)    :
    algo === "insertion" ? insertionSteps(items) :
                           selectionSteps(items);
  return { algo, steps, finalArr };
}

/** Round 1 → bubble, 2 → insertion, 3 → selection, 4 → bubble … */
export function algoForRound(round: number): SortAlgo {
  return ALGO_ORDER[(Math.max(round, 1) - 1) % ALGO_ORDER.length];
}

export function randomAlgo(): SortAlgo {
  return ALGO_ORDER[Math.floor(Math.random() * ALGO_ORDER.length)];
}
