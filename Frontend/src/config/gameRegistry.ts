
export type GameType =
  | "dijkstra"
  | "bst"
  | "floyd-warshall"
  | "sorting"
  | "fifo"
  | "lifo";

export interface GameRegistryEntry {
  /** Human-readable title shown in headings and cards */
  title: string;
  /** Short description shown in Dashboard game cards */
  description: string;
  /** Lucide icon name — use `gameIconMap` in components to resolve */
  iconName: string;
  /** URL segment used in /game/:gameType — must match the GameType union */
  routeKey: GameType;
}

export const gameRegistry: Record<GameType, GameRegistryEntry> = {
  dijkstra: {
    title:       "Dijkstra's Adventure",
    description: "Find the shortest path step by step",
    iconName:    "Route",
    routeKey:    "dijkstra",
  },
  bst: {
    title:       "BST Builder",
    description: "Build a binary search tree by placing numbers",
    iconName:    "GitBranch",
    routeKey:    "bst",
  },
  "floyd-warshall": {
    title:       "Floyd-Warshall Grid",
    description: "Fill the all-pairs shortest path matrix",
    iconName:    "Grid3x3",
    routeKey:    "floyd-warshall",
  },
  sorting: {
    title:       "Sorting Showdown",
    description: "Sort the bars by hand — bubble, insertion, selection, merge, quick & heap",
    iconName:    "ArrowUpDown",
    routeKey:    "sorting",
  },
  fifo: {
    title:       "Queue Rush",
    description: "Keep the line moving: enqueue and serve in first-in, first-out order",
    iconName:    "ListOrdered",
    routeKey:    "fifo",
  },
  lifo: {
    title:       "Stack Strike",
    description: "Beat the stack: push and pop in last-in, first-out order",
    iconName:    "Layers",
    routeKey:    "lifo",
  },
} as const;

/**
 * Convenience — ordered list for iteration (Dashboard card order, etc.)
 */
export const gameRegistryList: GameRegistryEntry[] = [
  gameRegistry["dijkstra"],
  gameRegistry["bst"],
  gameRegistry["floyd-warshall"],
  gameRegistry["sorting"],
  gameRegistry["fifo"],
  gameRegistry["lifo"],
];

/**
 * Type guard — narrows an arbitrary string to GameType.
 */
export function isGameType(value: string | undefined): value is GameType {
  return (
    value === "dijkstra" ||
    value === "bst" ||
    value === "floyd-warshall" ||
    value === "sorting" ||
    value === "fifo" ||
    value === "lifo"
  );
}
