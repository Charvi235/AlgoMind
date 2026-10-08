/**
 * RandomQueue.tsx
 *
 * Route: /game/:gameType/queue
 *
 * Joins the server's matchmaking queue and waits for an opponent.
 * Joining happens on every socket "connect" event, so if the server
 * restarts or the connection drops, the player is re-queued automatically.
 */

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, WifiOff } from "lucide-react";
import { socket } from "../lib/socket";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import GlowNode from "../components/ui/GlowNode";
import { gameRegistry, isGameType } from "../config/gameRegistry";
import { gameIconMap } from "../config/gameIconMap";

const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0  },
};

const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
};

// Three concentric rings expand outward and fade, giving a "sonar" feel.
const RING_COUNT = 3;

export default function RandomQueue() {
  const { gameType } = useParams<{ gameType: string }>();
  const navigate     = useNavigate();
  const [connError, setConnError] = useState(false);

  // All hooks run BEFORE any early return (Rules of Hooks).
  useEffect(() => {
    if (!isGameType(gameType)) return;

    const joinQueue = () => {
      setConnError(false);
      socket.emit("join_queue", { gameType });
    };
    const onMatched = ({ roomId }: { roomId: string }) => {
      navigate(`/game/${gameType}/match/${roomId}`);
    };
    const onConnectError = () => setConnError(true);

    socket.on("connect", joinQueue);
    socket.on("connect_error", onConnectError);
    socket.on("matched", onMatched);

    if (socket.connected) joinQueue();
    else socket.connect();

    // The socket is intentionally NOT disconnected here: LiveMatch
    // reuses the same connection after matching.
    return () => {
      socket.emit("cancel_queue", { gameType });
      socket.off("connect", joinQueue);
      socket.off("connect_error", onConnectError);
      socket.off("matched", onMatched);
    };
  }, [gameType, navigate]);

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
    navigate(`/game/${gameType}/friends`); // effect cleanup emits cancel_queue
  };

  return (
    <motion.div
      className="flex flex-col gap-8 items-center justify-center min-h-[60vh]"
      variants={stagger}
      initial="hidden"
      animate="visible"
    >
      <motion.button
        variants={fadeUp}
        onClick={handleCancel}
        className="self-start flex items-center gap-1.5 text-sm text-textMuted hover:text-textPrimary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-node rounded"
        aria-label="Cancel and go back"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Cancel
      </motion.button>

      <motion.div variants={fadeUp} className="w-full max-w-sm">
        <Card className="flex flex-col items-center gap-8 !py-12 !px-8 text-center">

          {GameIcon && (
            <div className="flex items-center gap-2 rounded-full border border-panelBorder bg-background px-3 py-1.5">
              <GameIcon size={13} className="text-node" aria-hidden="true" />
              <span className="text-xs text-textMuted font-medium">{entry.title}</span>
            </div>
          )}

          <div
            className="relative flex items-center justify-center"
            style={{ width: 96, height: 96 }}
            aria-hidden="true"
          >
            {Array.from({ length: RING_COUNT }).map((_, i) => (
              <motion.span
                key={i}
                className="absolute rounded-full border border-node"
                style={{ width: 96, height: 96 }}
                animate={{ scale: [1, 2.4], opacity: [0.55, 0] }}
                transition={{ duration: 2, ease: "easeOut", repeat: Infinity, delay: i * 0.65 }}
              />
            ))}
            <GlowNode color="node" size={48}>
              <span className="rounded-full bg-panel" style={{ width: 28, height: 28 }} />
            </GlowNode>
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="font-sans text-base font-semibold text-textPrimary">
              Searching for an opponent…
            </p>
            {connError ? (
              <div
                role="alert"
                className="flex items-center justify-center gap-2 text-xs font-medium"
                style={{ color: "#FF6B8A" }}
              >
                <WifiOff size={14} aria-hidden="true" />
                Can't reach the server. Retrying…
              </div>
            ) : (
              <p className="font-sans text-sm text-textMuted">
                This usually takes a few seconds
              </p>
            )}
          </div>

          <motion.div className="flex items-center gap-1.5" aria-label="Loading" role="status">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="rounded-full bg-node"
                style={{ width: 6, height: 6 }}
                animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
              />
            ))}
          </motion.div>

          <Button variant="secondary" onClick={handleCancel} className="w-full">
            Cancel
          </Button>
        </Card>
      </motion.div>
    </motion.div>
  );
}