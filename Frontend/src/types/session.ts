/**
 * session.ts
 *
 * Shared types used by GameSessionShell, SoloSession, LiveMatch,
 * and ResultsScreen. Keep this file pure data — no React or DOM imports.
 */

// ─── Session mode ─────────────────────────────────────────────────────────────

export type SessionMode = "solo" | "live";

// ─── Per-player result snapshot ───────────────────────────────────────────────

export interface PlayerResult {
  /** Display label shown in ResultsScreen ("You" or opponent name/id) */
  label:           string;
  /** Total rounds where the player successfully completed the board */
  roundsCompleted: number;
  /** Total correct actions across all rounds (answers, placements, etc.) */
  correctCount:    number;
  /** Accuracy as a value 0–100 */
  accuracy:        number;
  /** XP earned this session (computed client-side, TODO: award server-side) */
  xp:              number;
}

// ─── Final session stats passed through route state ───────────────────────────

export interface SoloSessionStats {
  mode:    "solo";
  gameType: string;
  player:  PlayerResult;
}

export interface LiveSessionStats {
  mode:       "live";
  gameType:   string;
  roomId:     string;
  player:     PlayerResult;
  opponent:   PlayerResult;
  /** Determined by GameSessionShell / LiveMatch before navigating */
  winner:     "player" | "opponent" | "tie";
}

export type SessionStats = SoloSessionStats | LiveSessionStats;

// ─── Round-level event fired by each Board component ─────────────────────────

/**
 * Standardised round-completion payload.
 * Each Board fires this via its `onRoundComplete` prop whenever its
 * win-condition is met. The shell uses it to update round/score state.
 *
 * correctActions: number of individually correct moves in that round
 *   (edges picked, cells filled, operators chosen, questions answered)
 * totalActions:   maximum possible correct actions for that round
 */
export interface RoundCompletePayload {
  correctActions: number;
  totalActions:   number;
}

// ─── XP calculation ───────────────────────────────────────────────────────────

/**
 * Client-side XP estimate.
 *
 * TODO: XP should ultimately be computed and awarded server-side so it
 * cannot be spoofed. This client value is display-only until that endpoint
 * exists. Formula: base 50 per round + accuracy bonus (up to 50 per round).
 */
export function computeXP(roundsCompleted: number, accuracy: number): number {
  const base    = roundsCompleted * 50;
  const bonus   = Math.round((accuracy / 100) * roundsCompleted * 50);
  return base + bonus;
}
