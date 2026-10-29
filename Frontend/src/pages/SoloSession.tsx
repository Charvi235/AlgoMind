/**
 * SoloSession.tsx
 *
 * Route: /game/:gameType/solo
 *
 * For server-scored games (Dijkstra) the SERVER starts the session and,
 * when the timer ends, finishes it and returns the result (rounds,
 * accuracy, XP). The browser never sends a score. Other games still run
 * without XP until they get server validation.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import GameSessionShell, { type SessionEndStats } from "../components/GameSessionShell";
import Button from "../components/ui/Button";
import { isGameType } from "../config/gameRegistry";
import { SERVER_SCORED_GAMES } from "../config/scoring";
import { startSoloSession, finishSoloSession } from "../lib/soloApi";
import type { SoloSessionStats } from "../types/session";


export default function SoloSession() {
  const { gameType } = useParams<{ gameType: string }>();
  const navigate     = useNavigate();

  const validGame = isGameType(gameType) ? gameType : null;
  const scored    = validGame !== null && SERVER_SCORED_GAMES.has(validGame);

  const [sessionId,  setSessionId]  = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [startTry,   setStartTry]   = useState(0);
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState<string | null>(null);
  const endedRef = useRef(false);

  // Server-scored games: ask the server to start the session first.
  useEffect(() => {
    if (!validGame || !scored) return;
    let cancelled = false;
    setSessionId(null);
    setStartError(null);
    startSoloSession(validGame)
      .then((r) => { if (!cancelled) setSessionId(r.sessionId); })
      .catch((e: unknown) => {
        if (!cancelled) setStartError(e instanceof Error ? e.message : "Couldn't start the game.");
      });
    return () => { cancelled = true; };
  }, [validGame, scored, startTry]);

  const goToResults = useCallback((player: SoloSessionStats["player"]) => {
    if (!validGame) return;
    const stats: SoloSessionStats = { mode: "solo", gameType: validGame, player };
    navigate(`/game/${validGame}/results`, { state: stats });
  }, [navigate, validGame]);

  // Result comes from the server's own counters, not from the browser.
  const finish = useCallback(async () => {
    if (!sessionId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const r = await finishSoloSession(sessionId);
      goToResults({
        label: "You",
        roundsCompleted: r.roundsCompleted,
        correctCount: r.roundsCompleted,
        accuracy: r.accuracy,
        xp: r.xp,
      });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't save your result.");
      setSaving(false);
    }
  }, [sessionId, goToResults]);

  const handleSessionEnd = useCallback((raw: SessionEndStats) => {
    if (endedRef.current) return;
    endedRef.current = true;
    if (scored) { void finish(); return; }
    goToResults({
      label: "You",
      roundsCompleted: raw.roundsCompleted,
      correctCount: raw.correctCount,
      accuracy: raw.accuracy,
      xp: 0,
    });
  }, [scored, finish, goToResults]);

  if (!validGame) {
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

// <<<<<<< HEAD
//   const handleSessionEnd = (raw: SessionEndStats) => {
//     const stats: SoloSessionStats = {
//       mode:     "solo",
//       gameType,
//       matchIds: gameType === "bst" ? raw.matchIds : undefined,
//       player: {
//         label:           "You",
//         roundsCompleted: raw.roundsCompleted,
//         correctCount:    raw.correctCount,
//         accuracy:        raw.accuracy,
//         xp:              raw.xp || (gameType === "bst" ? 0 : computeXP(raw.roundsCompleted, raw.accuracy)),
//       },
//     };
//     navigate(`/game/${gameType}/results`, { state: stats });
//   };
// =======
  if (scored && startError) {
    return (
      <div role="alert" className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <p className="text-sm" style={{ color: "#FF6B8A" }}>{startError}</p>
        <Button variant="primary" onClick={() => setStartTry((n) => n + 1)}>Try again</Button>
        <button
          onClick={() => navigate(`/game/${validGame}`)}
          className="text-sm text-textMuted underline hover:text-textPrimary transition-colors"
        >
          Back
        </button>
      </div>
    );
  }

  if (scored && !sessionId) {
    return (
      <div className="flex items-center justify-center py-24">
        <motion.p
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 1.4 }}
          className="font-mono text-sm text-textMuted"
        >
          Starting your session…
        </motion.p>
      </div>
    );
  }
// >>>>>>> main

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
        onClick={() => navigate(`/game/${validGame}`)}
        className="flex items-center gap-1.5 w-fit text-sm text-textMuted hover:text-textPrimary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-node rounded"
        aria-label="Back to mode selection"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Back
      </motion.button>

      <GameSessionShell
        gameType={validGame}
        mode="solo"
        sessionId={sessionId ?? undefined}
        onSessionEnd={handleSessionEnd}
      />

      {saving && <p className="text-center text-sm text-textMuted">Saving your result…</p>}

      {saveError && (
        <div role="alert" className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm" style={{ color: "#FF6B8A" }}>{saveError}</p>
          <Button variant="primary" onClick={() => void finish()}>Try again</Button>
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