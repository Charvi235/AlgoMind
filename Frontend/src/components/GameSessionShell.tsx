
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
import { socket } from "../lib/socket";

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
const MAX_SOLO_BST_ROUNDS = 4;

// Per-game override — add a line here to give any game a different length.
const SESSION_SECONDS_BY_GAME: Partial<Record<GameType, number>> = {
  bst: 120,
  sorting: 420,   // sorting sessions get 5 extra minutes beyond the previous 2-minute limit
};

// ─── Session-end stats ─────────────────────────────────────────────────────────
export interface SessionEndStats {
  roundsCompleted: number;
  correctCount:    number;
  totalCount:      number;
  /** 0–100 */
  accuracy:        number;
  xp:              number;
  matchIds:        string[];
}

// ─── Props ─────────────────────────────────────────────────────────────────────
export interface GameSessionShellProps {
  gameType:      string;
  mode:          "solo" | "live";
  roomId?:       string;
  /**
   * For live mode — display name / identifier for the opponent.
   * Shown in the score bar next to the opponent's score.
   */
  opponentLabel?: string;
  /** Called when the 60-second timer expires */
  onSessionEnd:  (stats: SessionEndStats) => void;
}



const fmt2 = (n: number) => String(n).padStart(2, "0");
const formatCountdown = (s: number) => `${fmt2(Math.floor(s / 60))}:${fmt2(s % 60)}`;

// ─── Component ─────────────────────────────────────────────────────────────────
export default function GameSessionShell({
  gameType,
  mode,
  roomId,
  opponentLabel = "Opponent",
  onSessionEnd,
}: GameSessionShellProps) {
  const entry = isGameType(gameType) ? gameRegistry[gameType] : null;
  const Board = isGameType(gameType) ? BOARD_MAP[gameType] : null;

  // ── Timer ──────────────────────────────────────────────────────────────────
  const [timeLeft, setTimeLeft] = useState(
    isGameType(gameType) ? SESSION_SECONDS_BY_GAME[gameType] ?? DEFAULT_SESSION_SECONDS : DEFAULT_SESSION_SECONDS
  );

  // ── Round & score tracking ─────────────────────────────────────────────────
  const [round,        setRound]        = useState(1);
  const [playerScore,  setPlayerScore]  = useState(0);
  const [correctTotal, setCorrectTotal] = useState(0);
  const [totalActions, setTotalActions] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [earnedXp, setEarnedXp] = useState(0);
  const [matchIds, setMatchIds] = useState<string[]>([]);
  // boardKey forces a full remount of the Board on each new round
  const [boardKey, setBoardKey] = useState(0);

  // ── Opponent mock score (live mode only) ───────────────────────────────────
  const [opponentScore, setOpponentScore] = useState(0);
  const [bstRoundSeconds, setBstRoundSeconds] = useState(60);

  // ── Session-end ref to avoid stale closure in timer effect ────────────────
  const sessionEndRef = useRef(onSessionEnd);
  useEffect(() => { sessionEndRef.current = onSessionEnd; }, [onSessionEnd]);

  const statsRef = useRef({ round, correctTotal, totalActions, attempts, earnedXp, matchIds });
  const sessionEndedRef = useRef(false);
  useEffect(() => {
    statsRef.current = { round, correctTotal, totalActions, attempts, earnedXp, matchIds };
  }, [round, correctTotal, totalActions, attempts, earnedXp, matchIds]);

    // ── Countdown (only ticks; never triggers side effects itself) ────────────
  useEffect(() => {
    if (gameType === "bst" && mode === "solo") return;

    const id = setInterval(() => {
      setTimeLeft((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [gameType, mode]);

  // ── Session end — a separate effect, so the parent's onSessionEnd
  // (which navigates / sets state) never runs inside a state updater ──────
  useEffect(() => {
    if (gameType === "bst" && mode === "solo") return;
    if (timeLeft > 0) return;
    const { round: r, correctTotal: c, totalActions: tot, attempts: attemptsCount, earnedXp: xp, matchIds: ids } = statsRef.current;
    const accuracyDenominator = attemptsCount > 0 ? attemptsCount : tot;
    const accuracy = accuracyDenominator > 0 ? Math.round((c / accuracyDenominator) * 100) : 0;
    sessionEndRef.current({
      roundsCompleted: r - 1,
      correctCount:    c,
      totalCount:      tot,
      accuracy,
      xp,
      matchIds: ids,
    });
  }, [timeLeft, gameType, mode]);

  // ── Opponent live score (real Socket.io events) ──────────────────
  useEffect(() => {
    if (mode !== "live") return;

    const handler = ({ players }: {
      players?: Array<{ socketId: string; correctCount: number }>;
    }) => {
      if (!players) return;
      const me = players.find((player) => player.socketId === socket.id);
      const opponent = players.find((player) => player.socketId !== socket.id);
      if (me) setPlayerScore(me.correctCount * 10);
      if (opponent) setOpponentScore(opponent.correctCount * 10);
    };

    const legacyHandler = ({ score }: { score: number }) => setOpponentScore(score);
    socket.on("bst_progress", handler);
    socket.on("opponent_progress", legacyHandler);
    return () => {
      socket.off("bst_progress", handler);
      socket.off("opponent_progress", legacyHandler);
    };
  }, [mode]);
  // ── Round-complete callback (called by the active Board) ──────────────────
  const handleRoundComplete = useCallback((payload: RoundCompletePayload) => {
    if (sessionEndedRef.current) return;

    const completed = payload.completed !== false;
    const current = statsRef.current;
    const nextCorrect = current.correctTotal + (completed ? payload.correctActions : 0);
    const nextTotal = current.totalActions + (completed ? payload.totalActions : 0);
    const nextAttempts = current.attempts + (payload.attempts ?? 0);
    const nextXp = current.earnedXp + (payload.score ?? 0);
    const nextMatchIds = payload.matchId
      ? [...current.matchIds, payload.matchId]
      : current.matchIds;

    setAttempts(nextAttempts);
    setEarnedXp(nextXp);
    setMatchIds(nextMatchIds);

    if (completed) {
      setCorrectTotal(nextCorrect);
      setTotalActions(nextTotal);
      setPlayerScore((s) => s + (gameType === "sorting" ? 10 : payload.correctActions * 10));
    }

    if (gameType === "bst" && mode === "solo") {
      if (current.round >= MAX_SOLO_BST_ROUNDS) {
        sessionEndedRef.current = true;
        setTimeout(() => {
          const accuracyDenominator = nextAttempts > 0 ? nextAttempts : nextTotal;
          const accuracy = accuracyDenominator > 0 ? Math.round((nextCorrect / accuracyDenominator) * 100) : 0;
          sessionEndRef.current({
            roundsCompleted: current.round,
            correctCount: nextCorrect,
            totalCount: nextTotal,
            accuracy,
            xp: nextXp,
            matchIds: nextMatchIds,
          });
        }, 800);
        return;
      }
      setBstRoundSeconds(60);
    }

    // Solo mode: shell drives round progression by remounting the Board.
    // Live mode: the SERVER pushes the next round via Socket.io directly
    // to the Board (see onRoundChange below) — remounting here would
    // tear down the Board's socket listeners at the wrong moment.
    if (mode === "solo") {
      setTimeout(() => {
        setRound((r) => r + 1);
        setBoardKey((k) => k + 1);
      }, 800);
    }
  }, [gameType, mode]);

  const handleLiveRoundChange = useCallback((serverRound: number) => {
    setRound(serverRound);
  }, []);

  if (!entry || !Board) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-textMuted text-sm">Unknown game type: {gameType}</p>
      </div>
    );
  }

  const GameIcon = gameIconMap[entry.iconName] ?? Box;

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
            {formatCountdown(gameType === "bst" && mode === "solo" ? bstRoundSeconds : timeLeft)}
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
          mode={mode}
          roomId={roomId}
          onRoundComplete={handleRoundComplete}
          onRoundTimerChange={gameType === "bst" && mode === "solo" ? setBstRoundSeconds : undefined}
          onRoundChange={mode === "live" ? handleLiveRoundChange : undefined}
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
