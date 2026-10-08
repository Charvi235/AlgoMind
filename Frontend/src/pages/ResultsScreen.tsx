/**
 * ResultsScreen.tsx
 *
 * Route: /game/:gameType/results
 *
 * Reads session stats from router location state (passed by SoloSession
 * or LiveMatch via navigate(..., { state })).
 *
 * Solo mode  — one Card: rounds, accuracy, XP earned.
 * Live mode  — two Cards side by side (or stacked on mobile), winner
 *              bordered in gold with "You won!" / "You lost" / "It's a tie".
 */



import { useEffect } from "react";
import { getToken } from "../lib/auth";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Trophy, RotateCcw, LayoutDashboard, Target, CheckCircle2, Zap } from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import type { SessionStats, SoloSessionStats, LiveSessionStats, PlayerResult } from "../types/session";
import { isGameType } from "../config/gameRegistry";
import { gameRegistry } from "../config/gameRegistry";
import { gameIconMap } from "../config/gameIconMap";
import { Box } from "lucide-react";

// ─── Animation variants ───────────────────────────────────────────────────────
const cardVariant = {
  hidden:  { opacity: 0, scale: 0.92, y: 20 },
  visible: { opacity: 1, scale: 1,    y: 0  },
};

const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

// ─── Stat row helper ──────────────────────────────────────────────────────────
function StatRow({ icon: Icon, label, value, accent = "text-textPrimary" }: {
  icon:    React.ElementType;
  label:   string;
  value:   string;
  accent?: string;
}) {

  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-panelBorder last:border-0">
      <div className="flex items-center gap-2 text-textMuted">
        <Icon size={14} aria-hidden="true" />
        <span className="text-sm">{label}</span>
      </div>
      <span className={`font-mono text-sm font-bold ${accent}`}>{value}</span>
    </div>
  );
}

// ─── Solo result card ─────────────────────────────────────────────────────────
function SoloResultCard({ stats }: { stats: SoloSessionStats }) {
  const p = stats.player;
  return (
    <motion.div variants={cardVariant} transition={{ type: "spring", stiffness: 260, damping: 22 }}>
      <Card className="flex flex-col gap-6 w-full max-w-sm mx-auto">
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 size={48} className="text-teal drop-shadow-[0_0_12px_#6EE7C4]" aria-hidden="true" />
          <h1 className="font-sans text-2xl font-bold text-textPrimary">Session Complete</h1>
        </div>

        <div className="flex flex-col">
          <StatRow
            icon={RotateCcw}
            label="Rounds completed"
            value={String(p.roundsCompleted)}
            accent="text-textPrimary"
          />
          <StatRow
            icon={Target}
            label="Accuracy"
            value={`${p.accuracy}%`}
            accent={p.accuracy >= 80 ? "text-teal" : p.accuracy >= 50 ? "text-gold" : "text-textPrimary"}
          />
          <StatRow
            icon={Zap}
            label="XP earned"
            value={`+${p.xp}`}
            accent="text-gold"
          />
        </div>

        {/* XP note */}
        <p className="text-xs text-textMuted text-center">
          {/* TODO: XP should be awarded server-side and verified against the session record.
              This client-side value is display-only until the POST /api/sessions/complete
              endpoint exists and returns the authoritative XP grant. */}
          XP is provisional until confirmed by the server.
        </p>
      </Card>
    </motion.div>
  );
}

// ─── Live result cards ────────────────────────────────────────────────────────
function PlayerResultCard({
  player,
  isWinner,
  isSelf,
}: {
  player:   PlayerResult;
  isWinner: boolean;
  isSelf:   boolean;
}) {
  return (
    <motion.div
      variants={cardVariant}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className="flex-1 min-w-0"
    >
      <Card
        className={[
          "flex flex-col gap-5 h-full",
          isWinner ? "border-2 !border-gold" : "",
        ].join(" ")}
        style={isWinner ? { boxShadow: "0 0 0 2px rgba(255,211,110,0.2), 0 0 24px 6px rgba(255,211,110,0.12)" } : undefined}
      >
        {/* Player label + winner badge */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs uppercase tracking-widest text-textMuted">
              {isSelf ? "You" : "Opponent"}
            </span>
            <span className="font-sans text-base font-bold text-textPrimary">{player.label}</span>
          </div>
          {isWinner && (
            <Trophy size={20} className="text-gold drop-shadow-[0_0_6px_#FFD36E]" aria-hidden="true" />
          )}
        </div>

        <div className="flex flex-col">
          <StatRow
            icon={RotateCcw}
            label="Rounds"
            value={String(player.roundsCompleted)}
            accent="text-textPrimary"
          />
          <StatRow
            icon={Target}
            label="Accuracy"
            value={`${player.accuracy}%`}
            accent={player.accuracy >= 80 ? "text-teal" : "text-textPrimary"}
          />
          <StatRow
            icon={Zap}
            label="XP"
            value={`+${player.xp}`}
            accent="text-gold"
          />
        </div>
      </Card>
    </motion.div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ResultsScreen() {
  const { gameType } = useParams<{ gameType: string }>();
  const navigate     = useNavigate();
  const location     = useLocation();
  const stats        = location.state as SessionStats | null;

    // Save solo session results server-side (guests silently skipped —
  // live match results are already saved server-side in socketHandlers.ts)
  useEffect(() => {
    if (!stats || stats.mode !== "solo") return;
    const token = getToken();
    if (!token) return; // guest — not logged in, skip saving

    const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
    fetch(`${API_BASE}/api/sessions/solo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ correctCount: stats.player.correctCount }),
    }).catch(() => {
      // Non-critical — results screen still shows even if save fails
    });
  }, [stats]);
  // Guard: no stats in state (e.g. navigated directly) → redirect to mode select
  if (!stats || !isGameType(gameType)) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-24 text-center">
        <p className="text-textMuted text-sm">No session data found.</p>
        <Button variant="primary" onClick={() => navigate("/")}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const entry    = gameRegistry[gameType];
  const GameIcon = gameIconMap[entry.iconName] ?? Box;

  // ── Live mode headline ──────────────────────────────────────────────────
  function liveHeadline(s: LiveSessionStats): { text: string; color: string } {
    switch (s.winner) {
      case "player":   return { text: "You won!",    color: "text-gold"        };
      case "opponent": return { text: "You lost.",   color: "text-textMuted"   };
      default:         return { text: "It's a tie!", color: "text-teal"        };
    }
  }

  return (
    <motion.div
      className="flex flex-col gap-8 max-w-2xl mx-auto"
      variants={stagger}
      initial="hidden"
      animate="visible"
    >
      {/* Game identity header */}
      <motion.div
        variants={cardVariant}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="flex flex-col items-center gap-3 text-center"
      >
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl border border-panelBorder bg-panel shadow-glow-node"
          aria-hidden="true"
        >
          <GameIcon size={26} className="text-node" />
        </div>
        <h1 className="font-sans text-2xl font-bold text-textPrimary">{entry.title}</h1>

        {stats.mode === "live" && (() => {
          const { text, color } = liveHeadline(stats as LiveSessionStats);
          return (
            <span className={`font-sans text-xl font-bold ${color}`}>{text}</span>
          );
        })()}
      </motion.div>

      {/* Result card(s) */}
      {stats.mode === "solo" ? (
        <SoloResultCard stats={stats as SoloSessionStats} />
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
          <PlayerResultCard
            player={(stats as LiveSessionStats).player}
            isWinner={(stats as LiveSessionStats).winner === "player"}
            isSelf={true}
          />
          <PlayerResultCard
            player={(stats as LiveSessionStats).opponent}
            isWinner={(stats as LiveSessionStats).winner === "opponent"}
            isSelf={false}
          />
        </div>
      )}

      {/* Action buttons */}
      <motion.div
        variants={cardVariant}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="flex flex-col gap-3 sm:flex-row sm:justify-center"
      >
        <Button
          variant="primary"
          onClick={() => navigate(`/game/${gameType}`)}
          className="gap-2 sm:w-48"
        >
          <RotateCcw size={15} aria-hidden="true" />
          Play Again
        </Button>
        <Button
          variant="secondary"
          onClick={() => navigate("/")}
          className="gap-2 sm:w-48"
        >
          <LayoutDashboard size={15} aria-hidden="true" />
          Dashboard
        </Button>
      </motion.div>
    </motion.div>
  );
}
