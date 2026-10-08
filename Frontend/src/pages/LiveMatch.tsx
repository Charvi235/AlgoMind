/**
 * LiveMatch.tsx
 *
 * Route: /game/:gameType/match/:roomId
 *
 * Thin wrapper around GameSessionShell for live (multiplayer) mode.
 * The SERVER decides when the match ends: results are built from the
 * `match_end` socket event (real stats + winner for both players).
 * The shell's local timer only shows "Time's up!" and starts a short
 * wait for that event, with a fallback if it never arrives.
 */

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, WifiOff } from "lucide-react";
import GameSessionShell from "../components/GameSessionShell";
import { socket } from "../lib/socket";
import type { LiveSessionStats, PlayerResult } from "../types/session";
import { isGameType } from "../config/gameRegistry";

interface MatchEndResult {
  socketId:        string;
  username:        string | null;
  roundsCompleted: number;
  accuracy:        number;
  xp:              number;
}

interface MatchEndPayload {
  results:        MatchEndResult[];
  winnerSocketId: string | null; // null = tie
}

// How long to wait for match_end after our local timer hits zero.
const RESULTS_WAIT_MS = 10000;

function toPlayerResult(r: MatchEndResult, label: string): PlayerResult {
  return {
    label,
    roundsCompleted: r.roundsCompleted,
    correctCount:    r.roundsCompleted,
    accuracy:        r.accuracy,
    xp:              r.xp,
  };
}

export default function LiveMatch() {
  const { gameType, roomId } = useParams<{ gameType: string; roomId: string }>();
  const navigate             = useNavigate();

  const [opponentLeft,      setOpponentLeft]      = useState(false);
  const [waitingForResults, setWaitingForResults] = useState(false);
  const [resultsTimedOut,   setResultsTimedOut]   = useState(false);

  // ── Server-driven match end + opponent-left notice ─────────────────────
  useEffect(() => {
    if (!gameType) return;

    const onMatchEnd = ({ results, winnerSocketId }: MatchEndPayload) => {
      const me  = results.find((r) => r.socketId === socket.id);
      const opp = results.find((r) => r.socketId !== socket.id);
      if (!me || !opp) return;

      const winner: LiveSessionStats["winner"] =
        winnerSocketId === null        ? "tie" :
        winnerSocketId === socket.id   ? "player" :
                                         "opponent";

      const stats: LiveSessionStats = {
        mode:     "live",
        gameType,
        roomId:   roomId ?? "unknown",
        player:   toPlayerResult(me, "You"),
        opponent: toPlayerResult(opp, opp.username ?? "Opponent"),
        winner,
      };
      navigate(`/game/${gameType}/results`, { state: stats });
    };

    const onOpponentLeft = () => setOpponentLeft(true);

    socket.on("match_end", onMatchEnd);
    socket.on("opponent_left", onOpponentLeft);
    return () => {
      socket.off("match_end", onMatchEnd);
      socket.off("opponent_left", onOpponentLeft);
    };
  }, [gameType, roomId, navigate]);

  // ── Fallback if match_end never arrives after our timer ended ──────────
  useEffect(() => {
    if (!waitingForResults) return;
    const id = setTimeout(() => setResultsTimedOut(true), RESULTS_WAIT_MS);
    return () => clearTimeout(id);
  }, [waitingForResults]);

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

  const resolvedRoomId = roomId ?? "unknown";

  // Disconnecting the socket lets the server notify the opponent
  // (opponent_left) instead of leaving them playing against a ghost.
  const handleLeave = () => {
    socket.disconnect();
    navigate(`/game/${gameType}/friends`);
  };

  return (
    <motion.div
      className="flex flex-col gap-4"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0  }}
      exit={{    opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
    >
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        onClick={handleLeave}
        className="flex items-center gap-1.5 w-fit text-sm text-textMuted hover:text-textPrimary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-node rounded"
        aria-label="Leave match"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Leave match
      </motion.button>

      <div className="flex items-center gap-2">
        <span className="text-xs text-textMuted">Room:</span>
        <span className="font-mono text-xs text-node border border-panelBorder bg-panel rounded px-2 py-0.5">
          {resolvedRoomId}
        </span>
      </div>

      {opponentLeft && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium"
          style={{
            borderColor: "rgba(255,107,138,0.35)",
            background:  "rgba(255,107,138,0.07)",
            color:       "#FF6B8A",
          }}
        >
          <WifiOff size={14} aria-hidden="true" />
          Your opponent disconnected. The match will end shortly.
        </div>
      )}

      <GameSessionShell
        gameType={gameType}
        mode="live"
        onSessionEnd={() => setWaitingForResults(true)}
      />

      {waitingForResults && !resultsTimedOut && (
        <p className="text-center text-sm text-textMuted">Waiting for final results…</p>
      )}

      {resultsTimedOut && (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-textMuted">
            We couldn't fetch the final results. The match may have ended early.
          </p>
          <button
            onClick={() => navigate("/")}
            className="text-sm text-textMuted underline hover:text-textPrimary transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      )}
    </motion.div>
  );
}