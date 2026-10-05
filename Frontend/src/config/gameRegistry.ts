/**
 * gameRegistry.ts
 *
 * Single source of truth for every game's metadata.
 * All titles, descriptions, icons, and route keys are defined here.
 * No game name, description, or icon should be hardcoded anywhere else.
 */

// Lucide icon names — resolved to actual components at call-site
// We store the name as a string so the registry is serialisable;
// consumers call `gameIconMap[entry.iconName]` to get the component.
export type GameType =
  | "dijkstra"
  | "bst"
  | "floyd-warshall"
  | "missing-operator"
  | "maths-questions";

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
  "missing-operator": {
    title:       "Missing Operator",
    description: "Find the operator that makes it true",
    iconName:    "Calculator",
    routeKey:    "missing-operator",
  },
  "maths-questions": {
    title:       "Interesting Maths Questions",
    description: "Solve curated logic puzzles",
    iconName:    "Brain",
    routeKey:    "maths-questions",
  },
} as const;

/**
 * Convenience — ordered list for iteration (Dashboard card order, etc.)
 */
export const gameRegistryList: GameRegistryEntry[] = [
  gameRegistry["dijkstra"],
  gameRegistry["bst"],
  gameRegistry["floyd-warshall"],
  gameRegistry["missing-operator"],
  gameRegistry["maths-questions"],
];

/**
 * Type guard — narrows an arbitrary string to GameType.
 */
export function isGameType(value: string | undefined): value is GameType {
  return (
    value === "dijkstra" ||
    value === "bst" ||
    value === "floyd-warshall" ||
    value === "missing-operator" ||
    value === "maths-questions"
  );
}
