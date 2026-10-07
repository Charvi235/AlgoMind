/**
 * RandomQueue.tsx
 *
 * Route: /game/:gameType/queue
 *
 * Shows a pulsing search indicator while the player waits to be matched
 * with a random opponent.
 *
 * ─── MOCK / TODO ────────────────────────────────────────────────────────────
 * The 3-second setTimeout below simulates finding a match.
 * Replace the entire matchmaking block with:
 *
 *   1. On mount, emit  socket.emit("join-queue", { gameType, userId })
 *   2. Listen for     socket.on("matched", ({ roomId }) => { ... })
 *      and navigate to `/game/${gameType}/match/${roomId}` on that event.
 *   3. On unmount / cancel, emit socket.emit("leave-queue", { gameType, userId })
 *
 * The socket instance should come from a shared SocketContext / useSocket hook.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { socket } from "../lib/socket";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import GlowNode from "../components/ui/GlowNode";
import { gameRegistry, isGameType } from "../config/gameRegistry";
import { gameIconMap } from "../config/gameIconMap";

// ─── Animation variants ───────────────────────────────────────────────────────
const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0  },
};

const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
};

// ─── Pulsing ring animation ───────────────────────────────────────────────────
// Three concentric rings expand outward and fade, giving a "sonar" feel.
const RING_COUNT = 3;

// ─── Mock match delay (ms) ───────────────────────────────────────────────────
const MOCK_MATCH_DELAY_MS = 3000;

// ─── Component ────────────────────────────────────────────────────────────────
export default function RandomQueue() {
  const { gameType } = useParams<{ gameType: string }>();
  const navigate     = useNavigate();
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cancelled, setCancelled] = useState(false);

  if (!isGameType(gameType)) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <p className="text-lg font-semibold text-textPrimary">Unknown game type.</p>
        <button onClick={() => navigate("/")} className="text-sm text-textMuted underline hover:text-textPrimary transition-colors">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const entry    = gameRegistry[gameType];
  const GameIcon = gameIconMap[entry.iconName];

  const handleCancel = () => {
    setCancelled(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    // TODO: emit socket.emit("leave-queue", { gameType }) here
    navigate(`/game/${gameType}/friends`);
  };

 useEffect(() => {
  if (!gameType) return;

  socket.connect();
  socket.emit("join_queue", { gameType });

  socket.on("matched", ({ roomId }: { roomId: string }) => {
    navigate(`/game/${gameType}/match/${roomId}`);
  });

  return () => {
    socket.emit("cancel_queue", { gameType });
    socket.off("matched");
  };
}, [gameType, navigate]);

  return (
    <motion.div
      className="flex flex-col gap-8 items-center justify-center min-h-[60vh]"
      variants={stagger}
      initial="hidden"
      animate="visible"
    >
      {/* Back button */}
      <motion.button
        variants={fadeUp}
        onClick={handleCancel}
        className="self-start flex items-center gap-1.5 text-sm text-textMuted hover:text-textPrimary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-node rounded"
        aria-label="Cancel and go back"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Cancel
      </motion.button>

      {/* Main card */}
      <motion.div variants={fadeUp} className="w-full max-w-sm">
        <Card className="flex flex-col items-center gap-8 !py-12 !px-8 text-center">

          {/* Game identity pill */}
          {GameIcon && (
            <div className="flex items-center gap-2 rounded-full border border-panelBorder bg-background px-3 py-1.5">
              <GameIcon size={13} className="text-node" aria-hidden="true" />
              <span className="text-xs text-textMuted font-medium">{entry.title}</span>
            </div>
          )}

          {/* Pulsing sonar indicator */}
          <div
            className="relative flex items-center justify-center"
            style={{ width: 96, height: 96 }}
            aria-hidden="true"
          >
            {/* Expanding rings */}
            {Array.from({ length: RING_COUNT }).map((_, i) => (
              <motion.span
                key={i}
                className="absolute rounded-full border border-node"
                style={{ width: 96, height: 96 }}
                animate={{
                  scale:   [1, 2.4],
                  opacity: [0.55, 0],
                }}
                transition={{
                  duration: 2,
                  ease:     "easeOut",
                  repeat:   Infinity,
                  delay:    i * 0.65,
                }}
              />
            ))}

            {/* Centre node */}
            <GlowNode color="node" size={48}>
              {/* Inner dark inset so it reads as a hollow node shell */}
              <span
                className="rounded-full bg-panel"
                style={{ width: 28, height: 28 }}
              />
            </GlowNode>
          </div>

          {/* Status text */}
          <div className="flex flex-col gap-1.5">
            <p className="font-sans text-base font-semibold text-textPrimary">
              Searching for an opponent…
            </p>
            <p className="font-sans text-sm text-textMuted">
              This usually takes a few seconds
            </p>
          </div>

          {/* Animated dots while waiting */}
          <AnimatePresence>
            <motion.div
              className="flex items-center gap-1.5"
              aria-label="Loading"
              role="status"
            >
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="rounded-full bg-node"
                  style={{ width: 6, height: 6 }}
                  animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
                  transition={{
                    duration: 1.2,
                    repeat:   Infinity,
                    delay:    i * 0.2,
                    ease:     "easeInOut",
                  }}
                />
              ))}
            </motion.div>
          </AnimatePresence>

          {/* Cancel */}
          <Button variant="secondary" onClick={handleCancel} className="w-full">
            Cancel
          </Button>
        </Card>
      </motion.div>
    </motion.div>
  );
}
