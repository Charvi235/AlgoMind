
/**
 * GameSessionShell.tsx
 *
 * Generic session wrapper used by BOTH SoloSession and LiveMatch.
 * Contains zero game-specific logic. All game behaviour lives inside
 * the Board components; this shell only manages:
 *
 *   • A 60-second countdown timer
 *   • Round counter (increments on each onRoundComplete callback)
 *   • Running correct-action totals used to compute accuracy
 *   • Score display (solo: user only; live: user + opponent side-by-side)
 *   • Board component lookup via gameRegistry (no per-game branching)
 *   • Calling onSessionEnd with final stats when the timer expires
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Box } from "lucide-react";
import { gameRegistry, isGameType, type GameType } from "../config/gameRegistry";
import { gameIconMap } from "../config/gameIconMap";
import type { RoundCompletePayload } from "../types/session";

// ─── Board component map ───────────────────────────────────────────────────────
// Lazily import each board. We use a plain object lookup so the shell never
// contains any game-specific branching — only this single mapping.
import DijkstraBoard         from "./game-boards/DijkstraBoard";
import BSTBoard              from "./game-boards/BSTBoard";
import FloydWarshallBoard    from "./game-boards/FloydWarshallBoard";
import MissingOperatorBoard  from "./game-boards/MissingOperatorBoard";
import MathsQuestionsBoard   from "./game-boards/MathsQuestionsBoard";
import SortingBoard          from "./game-boards/SortingBoard";

type BoardComponent = React.ComponentType<{
  onRoundComplete?: (payload: RoundCompletePayload) => void;
  onReset?:         () => void;
  // Allow any additional board-specific props; they are not used by the shell
  [key: string]: unknown;
}>;

const BOARD_MAP: Record<GameType, BoardComponent> = {
  "dijkstra":         DijkstraBoard,
  "bst":              BSTBoard,
  "floyd-warshall":   FloydWarshallBoard,
  "missing-operator": MissingOperatorBoard,
  "maths-questions":  MathsQuestionsBoard,
  "sorting":          SortingBoard,
};

// ─── Session constants ─────────────────────────────────────────────────────────
const DEFAULT_SESSION_SECONDS = 60;

// Per-game override — add a line here to give any game a different length.
const SESSION_SECONDS_BY_GAME: Partial<Record<GameType, number>> = {
  sorting: 120,   // sorting rounds have 4–10 steps, so give players 2 minutes
};

// ─── Session-end stats ─────────────────────────────────────────────────────────
export interface SessionEndStats {
  roundsCompleted: number;
  correctCount:    number;
  totalCount:      number;
  /** 0–100 */
  accuracy:        number;
}

// ─── Props ─────────────────────────────────────────────────────────────────────
export interface GameSessionShellProps {
  gameType:      string;
  mode:          "solo" | "live";
  /**
   * For live mode — display name / identifier for the opponent.
   * Shown in the score bar next to the opponent's score.
   */
  opponentLabel?: string;
  /** Called when the 60-second timer expires */
  onSessionEnd:  (stats: SessionEndStats) => void;
}

// ─── Opponent mock score ───────────────────────────────────────────────────────
// TODO: Replace this entire mock with real Socket.io event handling.
//   socket.on("opponent-score-update", ({ score }) => setOpponentScore(score))
// The opponent score should be received via the live Socket.io connection,
// not incremented locally.
const MOCK_OPPONENT_TICK_MS  = 4500; // roughly every 4.5 s opponent "scores"
const MOCK_OPPONENT_GAIN_MIN = 1;
const MOCK_OPPONENT_GAIN_MAX = 3;

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmt2 = (n: number) => String(n).padStart(2, "0");
const formatCountdown = (s: number) => `${fmt2(Math.floor(s / 60))}:${fmt2(s % 60)}`;

// ─── Component ─────────────────────────────────────────────────────────────────
export default function GameSessionShell({
  gameType,
  mode,
  opponentLabel = "Opponent",
  onSessionEnd,
}: GameSessionShellProps) {
  // ── Validate gameType ──────────────────────────────────────────────────────
  if (!isGameType(gameType)) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-textMuted text-sm">Unknown game type: {gameType}</p>
      </div>
    );
  }

  const entry    = gameRegistry[gameType];
  const GameIcon = gameIconMap[entry.iconName] ?? Box;
  const Board    = BOARD_MAP[gameType];

  // ── Timer ──────────────────────────────────────────────────────────────────
  const [timeLeft, setTimeLeft] = useState(SESSION_SECONDS_BY_GAME[gameType] ?? DEFAULT_SESSION_SECONDS);
  const timerRunning = useRef(true);

  // ── Round & score tracking ─────────────────────────────────────────────────
  const [round,        setRound]        = useState(1);
  const [playerScore,  setPlayerScore]  = useState(0);
  const [correctTotal, setCorrectTotal] = useState(0);
  const [totalActions, setTotalActions] = useState(0);
  // boardKey forces a full remount of the Board on each new round
  const [boardKey, setBoardKey] = useState(0);

  // ── Opponent mock score (live mode only) ───────────────────────────────────
  const [opponentScore, setOpponentScore] = useState(0);

  // ── Session-end ref to avoid stale closure in timer effect ────────────────
  const sessionEndRef = useRef(onSessionEnd);
  useEffect(() => { sessionEndRef.current = onSessionEnd; }, [onSessionEnd]);

  const statsRef = useRef({ round, correctTotal, totalActions });
  useEffect(() => {
    statsRef.current = { round, correctTotal, totalActions };
  }, [round, correctTotal, totalActions]);

  // ── Countdown ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!timerRunning.current) return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(id);
          timerRunning.current = false;
          const { round: r, correctTotal: c, totalActions: tot } = statsRef.current;
          const accuracy = tot > 0 ? Math.round((c / tot) * 100) : 0;
          sessionEndRef.current({
            roundsCompleted: r - 1, // rounds fully completed (current round in progress)
            correctCount:    c,
            totalCount:      tot,
            accuracy,
          });
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Opponent mock score ticker (TODO: replace with socket) ────────────────
  useEffect(() => {
    if (mode !== "live") return;
    const id = setInterval(() => {
      // TODO: REMOVE this mock and replace with:
      //   socket.on("opponent-score-update", ({ score }) => setOpponentScore(score))
      setOpponentScore((s) =>
        s + MOCK_OPPONENT_GAIN_MIN +
        Math.floor(Math.random() * (MOCK_OPPONENT_GAIN_MAX - MOCK_OPPONENT_GAIN_MIN + 1))
      );
    }, MOCK_OPPONENT_TICK_MS);
    return () => clearInterval(id);
  }, [mode]);

  // ── Round-complete callback (called by the active Board) ──────────────────
  const handleRoundComplete = useCallback((payload: RoundCompletePayload) => {
    setCorrectTotal((c) => c + payload.correctActions);
    setTotalActions((t) => t + payload.totalActions);
    setPlayerScore((s) => s + payload.correctActions * 10);
    // Brief pause so the player sees their last action, then advance round
    setTimeout(() => {
      setRound((r) => r + 1);
      setBoardKey((k) => k + 1); // remount Board with fresh state
    }, 800);
  }, []);

  // ── Timer colour ──────────────────────────────────────────────────────────
  const timerColor =
    timeLeft <= 5  ? "#FF6B8A" :
    timeLeft <= 15 ? "#FFA040" :
                     "#E8ECFB";
  const timerGlow =
    timeLeft <= 5  ? "0 0 14px 4px rgba(255,107,138,0.55)" :
    timeLeft <= 15 ? "0 0 12px 3px rgba(255,160,64,0.45)"  : "none";

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between gap-3 rounded-xl border border-panelBorder bg-panel px-4 py-3 flex-wrap"
        role="status"
        aria-label="Session status"
      >
        {/* Left: game identity + round */}
        <div className="flex items-center gap-3 shrink-0">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-panelBorder bg-background"
            aria-hidden="true"
          >
            <GameIcon size={16} className="text-node" />
          </div>
          <div className="flex flex-col">
            <span className="font-sans text-xs text-textMuted leading-none">{entry.title}</span>
            <span className="font-mono text-sm font-bold text-textPrimary leading-tight">
              Round {round}
            </span>
          </div>
        </div>

        {/* Centre: countdown */}
        <motion.div
          className="flex flex-col items-center shrink-0"
          aria-live="polite"
          aria-label={`${timeLeft} seconds remaining`}
        >
          <span className="text-[10px] uppercase tracking-widest text-textMuted mb-0.5">Time</span>
          <motion.span
            animate={{ scale: timeLeft <= 5 ? [1, 1.12, 1] : 1 }}
            transition={timeLeft <= 5 ? { repeat: Infinity, duration: 0.7 } : {}}
            className="font-mono text-3xl font-bold tabular-nums leading-none"
            style={{ color: timerColor, textShadow: timerGlow, transition: "color 0.3s, text-shadow 0.3s" }}
          >
            {formatCountdown(timeLeft)}
          </motion.span>
        </motion.div>

        {/* Right: score(s) */}
        <div className="flex items-center gap-4 shrink-0">
          {mode === "live" && (
            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-widest text-textMuted mb-0.5">
                {opponentLabel}
              </span>
              <AnimatePresence mode="wait">
                <motion.span
                  key={opponentScore}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0  }}
                  transition={{ duration: 0.2 }}
                  className="font-mono text-2xl font-bold tabular-nums text-textMuted"
                >
                  {opponentScore}
                </motion.span>
              </AnimatePresence>
            </div>
          )}

          <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase tracking-widest text-textMuted mb-0.5">
              {mode === "live" ? "You" : "Score"}
            </span>
            <AnimatePresence mode="wait">
              <motion.span
                key={playerScore}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0  }}
                transition={{ duration: 0.2 }}
                className="font-mono text-2xl font-bold tabular-nums text-gold"
              >
                {playerScore}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Board ──────────────────────────────────────────────────────────── */}
      {/*
        boardKey changes on each new round, forcing a full unmount + remount
        of the Board so it starts fresh. No game-specific reset logic needed.
      */}
      {timeLeft > 0 ? (
        <Board
  key={boardKey}
  round={round}
  onRoundComplete={handleRoundComplete}
/>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center justify-center py-24"
        >
          <p className="font-sans text-lg font-semibold text-textPrimary">
            Time's up!
          </p>
        </motion.div>
      )}
    </div>
  );
}
