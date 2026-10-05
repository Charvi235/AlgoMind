/**
 * InviteScreen.tsx
 *
 * Route: /game/:gameType/invite
 *
 * Generates a room code, lets the host copy it or share a link, then
 * waits for a friend to join.
 *
 * ─── MOCK / TODO ─────────────────────────────────────────────────────────────
 * Room code generation:
 *   Replace the client-side `generateCode()` with the code returned from:
 *     POST /api/rooms/create  →  { roomId, code, expiresAt }
 *   Call that endpoint on mount and display the returned code.
 *
 * Waiting for opponent:
 *   Replace the mock 4-second setTimeout with:
 *     socket.on("opponent-joined", ({ roomId }) => navigate(`/game/${gameType}/match/${roomId}`))
 *   Emit socket.emit("host-room", { roomId }) after room creation.
 *   On unmount emit socket.emit("cancel-room", { roomId }).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Copy, Share2, Check } from "lucide-react";
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Mock room-code generator — 6 uppercase alphanumeric characters.
 *  TODO: replace with the code returned by POST /api/rooms/create */
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ─── Mock wait delay (ms) ────────────────────────────────────────────────────
const MOCK_WAIT_DELAY_MS = 4000;

// ─── Clipboard / Share helpers ────────────────────────────────────────────────
type CopyTarget = "code" | "link";

// ─── Component ────────────────────────────────────────────────────────────────
export default function InviteScreen() {
  const { gameType } = useParams<{ gameType: string }>();
  const navigate     = useNavigate();
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // TODO: derive roomCode from POST /api/rooms/create response, not client-side random
  const [roomCode] = useState<string>(() => generateCode());
  const [copiedTarget, setCopiedTarget] = useState<CopyTarget | null>(null);

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

  // Share link uses window.location.origin so it works on any domain/port
  const shareLink = `${window.location.origin}/join/${roomCode}`;

  // ── Copy helpers ──────────────────────────────────────────────────────────
  const handleCopy = useCallback(async (target: CopyTarget) => {
    const text = target === "code" ? roomCode : shareLink;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTarget(target);
      setTimeout(() => setCopiedTarget(null), 2000);
    } catch {
      // Clipboard API blocked — silently ignore (could add a toast here)
    }
  }, [roomCode, shareLink]);

  const handleShare = useCallback(async () => {
    // Use the native Web Share API when available (mobile browsers, PWA)
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join me in ${entry.title} on AlgoMind!`,
          text:  `Use room code ${roomCode} or click the link to join my game.`,
          url:   shareLink,
        });
        return;
      } catch {
        // User cancelled share sheet or share failed — fall through to clipboard copy
      }
    }
    // Fallback: copy the link to clipboard
    await handleCopy("link");
  }, [entry.title, roomCode, shareLink, handleCopy]);

  const handleCancel = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    // TODO: emit socket.emit("cancel-room", { roomCode }) here
    navigate(`/game/${gameType}/friends`);
  };

  // ── Mock "opponent joined" wait ───────────────────────────────────────────
  useEffect(() => {
    // TODO: REPLACE with real Socket.io listener:
    //   socket.emit("host-room", { roomCode });
    //   socket.on("opponent-joined", ({ roomId }) => navigate(`/game/${gameType}/match/${roomId}`));
    timerRef.current = setTimeout(() => {
      // TODO: replace "mock-room-id" with the real roomId from the socket "opponent-joined" event
      navigate(`/game/${gameType}/match/mock-room-id`);
    }, MOCK_WAIT_DELAY_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      // TODO: socket.off("opponent-joined"); socket.emit("cancel-room", { roomCode });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div
      className="flex flex-col gap-8 items-center"
      variants={stagger}
      initial="hidden"
      animate="visible"
    >
      {/* Back button */}
      <motion.button
        variants={fadeUp}
        onClick={handleCancel}
        className="self-start flex items-center gap-1.5 text-sm text-textMuted hover:text-textPrimary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-node rounded"
        aria-label="Go back"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Back
      </motion.button>

      {/* Main card */}
      <motion.div variants={fadeUp} className="w-full max-w-sm">
        <Card className="flex flex-col items-center gap-7 !py-10 !px-8 text-center">

          {/* Game identity pill */}
          {GameIcon && (
            <div className="flex items-center gap-2 rounded-full border border-panelBorder bg-background px-3 py-1.5">
              <GameIcon size={13} className="text-node" aria-hidden="true" />
              <span className="text-xs text-textMuted font-medium">{entry.title}</span>
            </div>
          )}

          {/* Heading */}
          <div className="flex flex-col gap-1.5">
            <h1 className="font-sans text-xl font-bold text-textPrimary">Invite a Friend</h1>
            <p className="text-sm text-textMuted">Share this code or link to start a match</p>
          </div>

          {/* Room code display */}
          <div className="flex flex-col items-center gap-3 w-full">
            <p className="text-xs uppercase tracking-widest text-textMuted">Room code</p>
            <motion.div
              className="rounded-xl border border-panelBorder bg-background px-6 py-4 w-full"
              style={{
                boxShadow: "0 0 0 1px rgba(127,168,255,0.15), inset 0 0 20px rgba(127,168,255,0.04)",
              }}
              aria-label={`Room code: ${roomCode.split("").join(" ")}`}
            >
              <span
                className="font-mono text-4xl font-bold tracking-[0.25em] text-node"
                aria-hidden="true"
              >
                {roomCode}
              </span>
            </motion.div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-3 w-full">
            {/* Copy code */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 380, damping: 22 }}
              onClick={() => handleCopy("code")}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-panelBorder bg-background px-4 py-3 text-sm font-medium text-textPrimary hover:border-node/50 hover:bg-node/5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-node"
              aria-label="Copy room code to clipboard"
            >
              {copiedTarget === "code" ? (
                <>
                  <Check size={15} className="text-teal" aria-hidden="true" />
                  <span className="text-teal">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={15} aria-hidden="true" />
                  Copy Code
                </>
              )}
            </motion.button>

            {/* Copy / share link */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 380, damping: 22 }}
              onClick={handleShare}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-panelBorder bg-background px-4 py-3 text-sm font-medium text-textPrimary hover:border-gold/50 hover:bg-gold/5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              aria-label={typeof navigator !== "undefined" && navigator.share ? "Share invite link" : "Copy invite link to clipboard"}
            >
              {copiedTarget === "link" ? (
                <>
                  <Check size={15} className="text-teal" aria-hidden="true" />
                  <span className="text-teal">Link copied!</span>
                </>
              ) : (
                <>
                  <Share2 size={15} className="text-gold" aria-hidden="true" />
                  <span className="text-gold">
                    {typeof navigator !== "undefined" && navigator.share ? "Share Link" : "Copy Link"}
                  </span>
                </>
              )}
            </motion.button>
          </div>

          {/* Divider */}
          <div className="w-full h-px bg-panelBorder" />

          {/* Waiting indicator */}
          <div className="flex flex-col items-center gap-4">
            {/* Sonar rings around a small GlowNode */}
            <div
              className="relative flex items-center justify-center"
              style={{ width: 56, height: 56 }}
              aria-hidden="true"
            >
              {[0, 1].map((i) => (
                <motion.span
                  key={i}
                  className="absolute rounded-full border border-teal"
                  style={{ width: 56, height: 56 }}
                  animate={{ scale: [1, 2.2], opacity: [0.45, 0] }}
                  transition={{ duration: 2.2, ease: "easeOut", repeat: Infinity, delay: i * 0.9 }}
                />
              ))}
              <GlowNode color="teal" size={28}>
                <span className="rounded-full bg-panel" style={{ width: 14, height: 14 }} />
              </GlowNode>
            </div>

            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-textPrimary">
                Waiting for your friend to join…
              </p>
              <p className="text-xs text-textMuted">
                Share the code or link above
              </p>
            </div>
          </div>

          {/* Cancel */}
          <Button variant="secondary" onClick={handleCancel} className="w-full">
            Cancel
          </Button>
        </Card>
      </motion.div>

      {/* Link preview */}
      <motion.p
        variants={fadeUp}
        className="text-xs text-textMuted font-mono break-all text-center max-w-xs"
        aria-label={`Invite link: ${shareLink}`}
      >
        {shareLink}
      </motion.p>
    </motion.div>
  );
}
