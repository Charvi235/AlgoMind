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
  answer: boolean | number | string;
}

export interface SortRound {
  algo: SortAlgo;
  steps: SortStep[];
  finalArr: SortItem[];
}

const range = (from: number, to: number): number[] =>
  Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => from + index);

const clone = (items: SortItem[]): SortItem[] => items.map((item) => ({ ...item }));

function swap(items: SortItem[], first: number, second: number): void {
  [items[first], items[second]] = [items[second], items[first]];
}

function randomItems(count = 5): SortItem[] {
  const values = new Set<number>();
  while (values.size < count) values.add(10 + Math.floor(Math.random() * 90));
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  if (shuffled.every((value, index) => index === 0 || shuffled[index - 1] <= value)) {
    [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
  }
  return shuffled.map((value, id) => ({ id, value }));
}

function buildSteps(algo: SortAlgo, input: SortItem[]): SortRound {
  const arr = clone(input);
  const steps: SortStep[] = [];
  const n = arr.length;

  if (algo === "bubble") {
    for (let pass = 0; pass < n - 1; pass++) {
      for (let index = 0; index < n - 1 - pass; index++) {
        const answer = arr[index].value > arr[index + 1].value;
        steps.push({
          kind: "swap-or-keep",
          arr: clone(arr),
          focus: [index, index + 1],
          sorted: range(n - pass, n - 1),
          answer,
        });
        if (answer) swap(arr, index, index + 1);
      }
    }
  } else if (algo === "insertion") {
    for (let index = 1; index < n; index++) {
      let position = index;
      while (position > 0) {
        const answer = arr[position - 1].value > arr[position].value;
        steps.push({
          kind: "swap-or-keep",
          arr: clone(arr),
          focus: [position - 1, position],
          sorted: range(0, index).filter((item) => item !== position && item !== position - 1),
          answer,
        });
        if (!answer) break;
        swap(arr, position - 1, position);
        position--;
      }
    }
  } else if (algo === "selection") {
    for (let index = 0; index < n - 1; index++) {
      let minIndex = index;
      for (let candidate = index + 1; candidate < n; candidate++) {
        if (arr[candidate].value < arr[minIndex].value) minIndex = candidate;
      }
      steps.push({
        kind: "pick-min",
        arr: clone(arr),
        focus: [],
        sorted: range(0, index - 1),
        range: [index, n - 1],
        answer: minIndex,
      });
      if (minIndex !== index) swap(arr, index, minIndex);
    }
  } else if (algo === "merge") {
    const mergeSort = (start: number, end: number): void => {
      if (start >= end) return;
      const middle = Math.floor((start + end) / 2);
      mergeSort(start, middle);
      mergeSort(middle + 1, end);

      const left = arr.slice(start, middle + 1);
      const right = arr.slice(middle + 1, end + 1);
      const merged: SortItem[] = [];
      let leftIndex = 0;
      let rightIndex = 0;

      while (leftIndex < left.length && rightIndex < right.length) {
        const takeLeft = left[leftIndex].value <= right[rightIndex].value;
        const leftPosition = start + leftIndex;
        const rightPosition = middle + 1 + rightIndex;
        steps.push({
          kind: "pick-choice",
          arr: clone(arr),
          focus: [leftPosition, rightPosition],
          sorted: range(start, start + merged.length - 1),
          prompt: "During this merge, which side contributes the next value?",
          choices: [
            { value: "left", label: `Left: ${left[leftIndex].value}` },
            { value: "right", label: `Right: ${right[rightIndex].value}` },
          ],
          answer: takeLeft ? "left" : "right",
        });
        merged.push(takeLeft ? left[leftIndex++] : right[rightIndex++]);
      }

      merged.push(...left.slice(leftIndex), ...right.slice(rightIndex));
      for (let index = 0; index < merged.length; index++) arr[start + index] = merged[index];
    };
    mergeSort(0, n - 1);
  } else if (algo === "quick") {
    const quickSort = (low: number, high: number): void => {
      if (low >= high) return;
      const pivot = arr[high].value;
      let boundary = low;
      for (let index = low; index < high; index++) {
        const side = arr[index].value < pivot ? "left" : "right";
        steps.push({
          kind: "pick-choice",
          arr: clone(arr),
          focus: [index, high],
          sorted: [],
          prompt: `The pivot is ${pivot}. Which side of the pivot belongs ${arr[index].value} on?`,
          choices: [
            { value: "left", label: "Left (less than pivot)" },
            { value: "right", label: "Right (pivot or greater)" },
          ],
          answer: side,
        });
        if (side === "left") swap(arr, boundary++, index);
      }
      swap(arr, boundary, high);
      quickSort(low, boundary - 1);
      quickSort(boundary + 1, high);
    };
    quickSort(0, n - 1);
  } else {
    const siftDown = (rootIndex: number, end: number): void => {
      let root = rootIndex;
      while (root * 2 + 1 <= end) {
        const left = root * 2 + 1;
        const right = left + 1;
        const candidates = [root, left];
        if (right <= end) candidates.push(right);
        let largest = root;
        for (const candidate of candidates) {
          if (arr[candidate].value > arr[largest].value) largest = candidate;
        }
        steps.push({
          kind: "pick-choice",
          arr: clone(arr),
          focus: candidates,
          sorted: range(end + 1, n - 1),
          prompt: "Choose the largest value in the heap parent-and-children group.",
          choices: candidates.map((index) => ({
            value: String(index),
            label: `${index === root ? "Parent" : index === left ? "Left child" : "Right child"}: ${arr[index].value}`,
          })),
          answer: String(largest),
        });
        if (largest === root) return;
        swap(arr, root, largest);
        root = largest;
      }
    };

    for (let index = Math.floor(n / 2) - 1; index >= 0; index--) siftDown(index, n - 1);
    for (let end = n - 1; end > 0; end--) {
      swap(arr, 0, end);
      siftDown(0, end - 1);
    }
  }

  return { algo, steps, finalArr: arr };
}

export function algoForRound(round: number): SortAlgo {
  const algorithms: SortAlgo[] = ["bubble", "insertion", "selection", "merge", "quick", "heap"];
  return algorithms[(Math.max(1, Math.floor(round)) - 1) % algorithms.length];
}

export function generateSortRound(round: number): SortRound {
  return buildSteps(algoForRound(round), randomItems());
}
