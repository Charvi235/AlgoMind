export type SortAlgo = "bubble" | "insertion" | "selection" | "merge" | "quick" | "heap";
export type SortStepKind = "swap-or-keep" | "pick-min" | "pick-choice";

export interface SortItem {
  id: number;
  value: number;
}

export interface SortChoice {
  value: string;
  label: string;
}

export interface SortStep {
  kind: SortStepKind;
  arr: SortItem[];
  focus: number[];
  sorted: number[];
  range?: [number, number];
  prompt?: string;
  choices?: SortChoice[];
}

export interface ActiveSortRound {
  roundId: string;
  algo: SortAlgo;
  stepIndex: number;
  totalSteps: number;
  step: SortStep | null;
  completed: boolean;
  finalArr?: SortItem[];
}

export const ALGO_INFO: Record<SortAlgo, { title: string; rule: string; complexity: string }> = {
  bubble: {
    title: "Bubble Sort",
    rule: "Compare the two glowing bars. If the left bar is taller, swap them; otherwise keep.",
    complexity: "O(n²)",
  },
  insertion: {
    title: "Insertion Sort",
    rule: "Insert the right bar into the sorted section. Swap left while its neighbour is taller.",
    complexity: "O(n²)",
  },
  selection: {
    title: "Selection Sort",
    rule: "Tap the shortest bar in the unsorted section.",
    complexity: "O(n²)",
  },
  merge: {
    title: "Merge Sort",
    rule: "While merging two sorted halves, choose which side contributes the next value.",
    complexity: "O(n log n)",
  },
  quick: {
    title: "Quick Sort",
    rule: "Using the last value as pivot, choose which side each value belongs on.",
    complexity: "O(n log n)",
  },
  heap: {
    title: "Heap Sort",
    rule: "Choose the largest value among the heap parent and its children.",
    complexity: "O(n log n)",
  },
};
