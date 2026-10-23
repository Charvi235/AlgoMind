import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import GameSessionShell from "../components/GameSessionShell";
import Button from "../components/ui/Button";
import { socket } from "../lib/socket";
import { isGameType } from "../config/gameRegistry";
import type { LiveSessionStats, PlayerResult } from "../types/session";

interface MatchPlayer {
  socketId: string;
  roundsCompleted: number;
  correctCount: number;
  accuracy: number;
  score: number;
}

interface MatchEndPayload {
  players: MatchPlayer[];
  winnerSocketId: string | null;
}

export default function LiveMatch() {
  const { gameType, roomId } = useParams<{ gameType: string; roomId: string }>();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const opponentLabel = "Opponent";
  const isSortingMatch = gameType === "sorting" && Boolean(roomId);

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
      setMatchError("Your friend left the match.");
    };
    const onMatchEnd = ({ players, winnerSocketId }: MatchEndPayload) => {
      const self = players.find((player) => player.socketId === socket.id);
      const opponent = players.find((player) => player.socketId !== socket.id);
      if (!self || !opponent) {
        setMatchError("The match ended, but its result could not be loaded.");
        setReady(false);
        return;
      }

      const result = (player: MatchPlayer, label: string): PlayerResult => ({
        label,
        roundsCompleted: player.roundsCompleted,
        correctCount: player.correctCount,
        accuracy: player.accuracy,
        xp: player.score,
      });
      const stats: LiveSessionStats = {
        mode: "live",
        gameType: "sorting",
        roomId,
        player: result(self, "You"),
        opponent: result(opponent, opponentLabel),
        winner: winnerSocketId === null
          ? "tie"
          : winnerSocketId === socket.id
            ? "player"
            : "opponent",
      };
      navigate(`/game/sorting/results`, { state: stats });
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

  if (!isGameType(gameType)) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <p className="text-lg font-semibold text-textPrimary">Unknown game type.</p>
        <button onClick={() => navigate("/")} className="text-sm text-textMuted underline">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const leaveMatch = () => {
    socket.emit("leave_match");
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
      <button
        onClick={leaveMatch}
        className="flex items-center gap-1.5 w-fit text-sm text-textMuted hover:text-textPrimary"
        aria-label="Leave match"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Leave match
      </button>

      <div className="flex items-center gap-2">
        <span className="text-xs text-textMuted">Room:</span>
        <span className="font-mono text-xs text-node border border-panelBorder bg-panel rounded px-2 py-0.5">
          {roomId}
        </span>
      </div>

      {(isSortingMatch ? matchError : "Live matches are currently available for Sorting Showdown only.") && (
        <div className="flex flex-col items-center gap-3 py-10">
          <p role="status" className="text-sm text-textMuted">
            {isSortingMatch ? matchError : "Live matches are currently available for Sorting Showdown only."}
          </p>
          {!ready && <Button variant="secondary" onClick={leaveMatch}>Back to Play with Friends</Button>}
        </div>
      )}

      {ready && (
        <GameSessionShell
          gameType={gameType}
          mode="live"
          roomId={roomId}
          opponentLabel={opponentLabel}
          onSessionEnd={() => {}}
        />
      )}
    </motion.div>
  );
}
