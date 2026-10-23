/**
 * LiveMatch.tsx
 *
 * Route: /game/:gameType/match/:roomId
 *
 * Dijkstra and Sorting use different server event payloads, while sharing
 * the same room page and result view.
 */

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, WifiOff } from "lucide-react";
import GameSessionShell from "../components/GameSessionShell";
import Button from "../components/ui/Button";
import { socket } from "../lib/socket";
import type { LiveSessionStats, PlayerResult } from "../types/session";
import { isGameType } from "../config/gameRegistry";

interface DijkstraMatchEndResult {
  socketId: string;
  username: string | null;
  roundsCompleted: number;
  accuracy: number;
  xp: number;
}

interface DijkstraMatchEndPayload {
  results: DijkstraMatchEndResult[];
  winnerSocketId: string | null;
}

interface SortingMatchPlayer {
  socketId: string;
  roundsCompleted: number;
  correctCount: number;
  accuracy: number;
  score: number;
}

interface SortingMatchEndPayload {
  roomId: string;
  players: SortingMatchPlayer[];
  winnerSocketId: string | null;
}

const RESULTS_WAIT_MS = 10000;

function toDijkstraPlayerResult(result: DijkstraMatchEndResult, label: string): PlayerResult {
  return {
    label,
    roundsCompleted: result.roundsCompleted,
    correctCount: result.roundsCompleted,
    accuracy: result.accuracy,
    xp: result.xp,
  };
}

export default function LiveMatch() {
  const { gameType, roomId } = useParams<{ gameType: string; roomId: string }>();
  const navigate = useNavigate();
  const isSortingMatch = gameType === "sorting" && Boolean(roomId);
  const opponentLabel = "Opponent";

  const [ready, setReady] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [opponentLeft, setOpponentLeft] = useState(false);
  const [waitingForResults, setWaitingForResults] = useState(false);
  const [resultsTimedOut, setResultsTimedOut] = useState(false);

  useEffect(() => {
    if (!isSortingMatch || !roomId) return;

    const joinMatch = () => socket.emit("join_match", { roomId });
    const onJoined = ({ status }: { roomId: string; status: "waiting" | "active" }) => {
      if (status !== "active") {
        setMatchError("Waiting for the other player to join.");
        return;
      }
      setMatchError(null);
      setReady(true);
    };
    const onRoomError = ({ message }: { message: string }) => {
      setReady(false);
      setMatchError(message);
    };
    const onOpponentLeft = () => {
      setReady(false);
      setOpponentLeft(true);
      setMatchError("Your friend left the match.");
    };
    const onMatchEnd = ({ players, winnerSocketId }: SortingMatchEndPayload) => {
      const player = players.find((item) => item.socketId === socket.id);
      const opponent = players.find((item) => item.socketId !== socket.id);
      if (!player || !opponent) {
        setMatchError("The match ended, but its result could not be loaded.");
        setReady(false);
        return;
      }

      const toResult = (item: SortingMatchPlayer, label: string): PlayerResult => ({
        label,
        roundsCompleted: item.roundsCompleted,
        correctCount: item.correctCount,
        accuracy: item.accuracy,
        xp: item.score,
      });
      const stats: LiveSessionStats = {
        mode: "live",
        gameType: "sorting",
        roomId,
        player: toResult(player, "You"),
        opponent: toResult(opponent, opponentLabel),
        winner: winnerSocketId === null
          ? "tie"
          : winnerSocketId === socket.id
            ? "player"
            : "opponent",
      };
      navigate("/game/sorting/results", { state: stats });
    };

    socket.on("sorting_room_joined", onJoined);
    socket.on("sorting_room_error", onRoomError);
    socket.on("opponent_left", onOpponentLeft);
    socket.on("sorting_match_end", onMatchEnd);
    socket.on("connect", joinMatch);
    if (socket.connected) joinMatch();
    else socket.connect();

    return () => {
      socket.off("sorting_room_joined", onJoined);
      socket.off("sorting_room_error", onRoomError);
      socket.off("opponent_left", onOpponentLeft);
      socket.off("sorting_match_end", onMatchEnd);
      socket.off("connect", joinMatch);
    };
  }, [isSortingMatch, navigate, opponentLabel, roomId]);

  useEffect(() => {
    if (!gameType || isSortingMatch) return;

    const onMatchEnd = ({ results, winnerSocketId }: DijkstraMatchEndPayload) => {
      const player = results.find((item) => item.socketId === socket.id);
      const opponent = results.find((item) => item.socketId !== socket.id);
      if (!player || !opponent) return;

      const winner: LiveSessionStats["winner"] = winnerSocketId === null
        ? "tie"
        : winnerSocketId === socket.id
          ? "player"
          : "opponent";
      const stats: LiveSessionStats = {
        mode: "live",
        gameType,
        roomId: roomId ?? "unknown",
        player: toDijkstraPlayerResult(player, "You"),
        opponent: toDijkstraPlayerResult(opponent, opponent.username ?? "Opponent"),
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
  }, [gameType, isSortingMatch, navigate, roomId]);

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
          onClick={() => navigate("/dashboard")}
          className="text-sm text-textMuted underline hover:text-textPrimary transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const handleLeave = () => {
    if (isSortingMatch) socket.emit("leave_match");
    else socket.disconnect();
    navigate(`/game/${gameType}/friends`);
  };

  return (
    <motion.div
      className="flex flex-col gap-4"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
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
          {roomId}
        </span>
      </div>

      {opponentLeft && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium"
          style={{
            borderColor: "rgba(255,107,138,0.35)",
            background: "rgba(255,107,138,0.07)",
            color: "#FF6B8A",
          }}
        >
          <WifiOff size={14} aria-hidden="true" />
          Your opponent disconnected. The match will end shortly.
        </div>
      )}

      {isSortingMatch && !ready && (
        <div className="flex flex-col items-center gap-3 py-10">
          <p role="status" className="text-sm text-textMuted">
            {matchError ?? "Connecting to the sorting match…"}
          </p>
          {matchError && <Button variant="secondary" onClick={handleLeave}>Back to Play with Friends</Button>}
        </div>
      )}

      {(!isSortingMatch || ready) && (
        <GameSessionShell
          gameType={gameType}
          mode="live"
          roomId={roomId}
          opponentLabel={opponentLabel}
          onSessionEnd={() => {
            if (!isSortingMatch) setWaitingForResults(true);
          }}
        />
      )}

      {waitingForResults && !resultsTimedOut && (
        <p className="text-center text-sm text-textMuted">Waiting for final results…</p>
      )}

      {resultsTimedOut && (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-textMuted">
            We couldn't fetch the final results. The match may have ended early.
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="text-sm text-textMuted underline hover:text-textPrimary transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      )}
    </motion.div>
  );
}
