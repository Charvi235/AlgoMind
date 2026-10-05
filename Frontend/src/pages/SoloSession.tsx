/**
 * SoloSession.tsx
 *
 * Route: /game/:gameType/solo
 *
 * Thin wrapper around GameSessionShell for solo (single-player) mode.
 * Reads gameType from the URL, renders the shell, and navigates to
 * ResultsScreen with session stats when the timer expires.
 */

import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import GameSessionShell, { type SessionEndStats } from "../components/GameSessionShell";
import { computeXP } from "../types/session";
import type { SoloSessionStats } from "../types/session";
import { isGameType } from "../config/gameRegistry";

export default function SoloSession() {
  const { gameType } = useParams<{ gameType: string }>();
  const navigate     = useNavigate();

  if (!isGameType(gameType)) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <p className="text-lg font-semibold text-textPrimary">Unknown game type.</p>
        <button
          onClick={() => navigate("/")}
          className="text-sm text-textMuted underline hover:text-textPrimary transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const handleSessionEnd = (raw: SessionEndStats) => {
    const stats: SoloSessionStats = {
      mode:     "solo",
      gameType,
      player: {
        label:           "You",
        roundsCompleted: raw.roundsCompleted,
        correctCount:    raw.correctCount,
        accuracy:        raw.accuracy,
        xp:              computeXP(raw.roundsCompleted, raw.accuracy),
      },
    };
    navigate(`/game/${gameType}/results`, { state: stats });
  };

  return (
    <motion.div
      className="flex flex-col gap-4"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0  }}
      exit={{    opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
    >
      {/* Back link (visible before time starts, navigates away from session) */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        onClick={() => navigate(`/game/${gameType}`)}
        className="flex items-center gap-1.5 w-fit text-sm text-textMuted hover:text-textPrimary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-node rounded"
        aria-label="Back to mode selection"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Back
      </motion.button>

      <GameSessionShell
        gameType={gameType}
        mode="solo"
        onSessionEnd={handleSessionEnd}
      />
    </motion.div>
  );
}
