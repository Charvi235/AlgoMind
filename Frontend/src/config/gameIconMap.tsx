/**
 * gameIconMap.tsx
 *
 * Resolves the string icon names stored in gameRegistry to their actual
 * lucide-react components. Kept separate so gameRegistry.ts stays
 * dependency-free (pure data) while consumers get real React components.
 *
 * Usage:
 *   import { gameIconMap } from "@/config/gameIconMap";
 *   const Icon = gameIconMap[entry.iconName] ?? Box;
 *   <Icon size={20} />
 */

import {
  Route,
  GitBranch,
  Grid3x3,
  Calculator,
  Brain,
  type LucideIcon,
} from "lucide-react";

export const gameIconMap: Record<string, LucideIcon> = {
  Route,
  GitBranch,
  Grid3x3,
  Calculator,
  Brain,
};
