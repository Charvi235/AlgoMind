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

export const ALGO_INFO: Record<SortAlgo, { title: string; rule: string; hint: string; complexity: string }> = {
  bubble: {
    title: "Bubble Sort",
    rule: "Compare the two glowing bars. If the left bar is taller, swap them; otherwise keep.",
    hint: "A pass moves large values toward the right. Compare adjacent bars and swap only when the left one is larger.",
    complexity: "O(n²)",
  },
  insertion: {
    title: "Insertion Sort",
    rule: "Insert the right bar into the sorted section. Swap left while its neighbour is taller.",
    hint: "The left section is already sorted. Move the new value left only past values that are larger than it.",
    complexity: "O(n²)",
  },
  selection: {
    title: "Selection Sort",
    rule: "Tap the shortest bar in the unsorted section.",
    hint: "Scan the unsorted section from left to right and keep track of its smallest value.",
    complexity: "O(n²)",
  },
  merge: {
    title: "Merge Sort",
    rule: "While merging two sorted halves, choose which side contributes the next value.",
    hint: "Both halves are sorted. Compare the first remaining value in each half and take the smaller one.",
    complexity: "O(n log n)",
  },
  quick: {
    title: "Quick Sort",
    rule: "Using the last value as pivot, choose which side each value belongs on.",
    hint: "Compare the current value with the pivot: smaller values belong to its left, larger values to its right.",
    complexity: "O(n log n)",
  },
  heap: {
    title: "Heap Sort",
    rule: "Choose the largest value among the heap parent and its children.",
    hint: "A max-heap keeps its largest value at the top. Compare a parent with its children, then sift the largest down.",
    complexity: "O(n log n)",
  },
};
