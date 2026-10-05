/**
 * LiveMatch.tsx
 *
 * Route: /game/:gameType/match/:roomId
 *
 * Thin wrapper around GameSessionShell for live (multiplayer) mode.
 * Reads gameType and roomId from the URL, renders the shell in live mode,
 * and navigates to ResultsScreen with both players' final stats when the
 * session ends.
 *
 * ─── TODO: REAL SOCKET.IO INTEGRATION ────────────────────────────────────────
 *
 * The following mock behaviours need replacing with real Socket.io calls:
 *
 * 1. JOINING THE ROOM
 *    On mount, emit:
 *      socket.emit("join-room", { roomId, gameType })
 *    Listen for a confirmation:
 *      socket.on("room-joined", ({ players }) => { ... })
 *    Use the returned player list to populate opponentLabel.
 *
 * 2. SYNCED START SIGNAL
 *    The session timer should NOT start until both players are ready.
 *    Listen for:
 *      socket.on("match-start", () => { setReady(true) })
 *    Pass a `ready` flag to GameSessionShell (add a prop) to hold the
 *    timer at SESSION_SECONDS until the server fires this event.
 *
 * 3. OPPONENT SCORE UPDATES
 *    The mock opponent ticker inside GameSessionShell should be replaced
 *    entirely. Instead, pass opponentScore as a controlled prop:
 *      socket.on("opponent-score-update", ({ score }) => setOpponentScore(score))
 *    Add an `opponentScore` prop to GameSessionShell and display it from
 *    the parent rather than managing it internally.
 *
 * 4. SYNCED END-OF-MATCH
 *    Replace the local 60-second timer expiry with a server-fired event:
 *      socket.on("match-end", ({ playerStats, opponentStats }) => { ... })
 *    Use the server-provided stats to build LiveSessionStats and navigate.
 *    The local timer can be kept as a fallback / visual display only.
 *
 * 5. CLEANUP
 *    On component unmount:
 *      socket.emit("leave-room", { roomId })
 *      socket.off("match-start")
 *      socket.off("opponent-score-update")
 *      socket.off("match-end")
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import GameSessionShell, { type SessionEndStats } from "../components/GameSessionShell";
import { computeXP } from "../types/session";
import type { LiveSessionStats } from "../types/session";
import { isGameType } from "../config/gameRegistry";

// ─── Mock opponent label ───────────────────────────────────────────────────────
// TODO: replace with the real opponent display name received from the server
// via the "room-joined" socket event.
const MOCK_OPPONENT_LABEL = "Opponent";

// ─── Mock opponent round count ────────────────────────────────────────────────
// TODO: replace with the opponentStats received in the "match-end" socket event.
function mockOpponentStats(playerRounds: number): {
  roundsCompleted: number;
  correctCount: number;
  accuracy: number;
} {
  const rounds   = Math.max(0, playerRounds + Math.floor(Math.random() * 3) - 1);
  const correct  = rounds * (5 + Math.floor(Math.random() * 5));
  const accuracy = rounds > 0 ? Math.min(100, 60 + Math.floor(Math.random() * 40)) : 0;
  return { roundsCompleted: rounds, correctCount: correct, accuracy };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function LiveMatch() {
  const { gameType, roomId } = useParams<{ gameType: string; roomId: string }>();
  const navigate             = useNavigate();

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

  const handleSessionEnd = (raw: SessionEndStats) => {
    // TODO: replace mockOpponentStats with real stats from the "match-end" socket event
    const oppRaw = mockOpponentStats(raw.roundsCompleted);

    const playerResult = {
      label:           "You",
      roundsCompleted: raw.roundsCompleted,
      correctCount:    raw.correctCount,
      accuracy:        raw.accuracy,
      xp:              computeXP(raw.roundsCompleted, raw.accuracy),
    };

    const opponentResult = {
      label:           MOCK_OPPONENT_LABEL,
      roundsCompleted: oppRaw.roundsCompleted,
      correctCount:    oppRaw.correctCount,
      accuracy:        oppRaw.accuracy,
      xp:              computeXP(oppRaw.roundsCompleted, oppRaw.accuracy),
    };

    const winner: LiveSessionStats["winner"] =
      playerResult.roundsCompleted > opponentResult.roundsCompleted ? "player" :
      playerResult.roundsCompleted < opponentResult.roundsCompleted ? "opponent" :
      "tie";

    const stats: LiveSessionStats = {
      mode:     "live",
      gameType,
      roomId:   resolvedRoomId,
      player:   playerResult,
      opponent: opponentResult,
      winner,
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
      {/* Back / abandon link */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        onClick={() => navigate(`/game/${gameType}/friends`)}
        className="flex items-center gap-1.5 w-fit text-sm text-textMuted hover:text-textPrimary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-node rounded"
        aria-label="Leave match"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Leave match
      </motion.button>

      {/* Room ID pill */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-textMuted">Room:</span>
        <span className="font-mono text-xs text-node border border-panelBorder bg-panel rounded px-2 py-0.5">
          {resolvedRoomId}
        </span>
      </div>

      <GameSessionShell
        gameType={gameType}
        mode="live"
        opponentLabel={MOCK_OPPONENT_LABEL}
        onSessionEnd={handleSessionEnd}
      />
    </motion.div>
  );
}
