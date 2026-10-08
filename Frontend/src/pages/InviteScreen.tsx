/**
 * InviteScreen.tsx
 *
 * Route: /game/:gameType/invite
 *
 * Creates a room via Socket.io, displays the server-issued code, lets
 * the host copy it or share a link, then waits for a friend to join.
 * If the host leaves before anyone joins, the room is cancelled on the
 * server so its code can't be used any more.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Copy, Share2, Check, WifiOff } from "lucide-react";
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

type CopyTarget = "code" | "link";

export default function InviteScreen() {
  const { gameType } = useParams<{ gameType: string }>();
  const navigate      = useNavigate();

  const [code, setCode]                 = useState<string | null>(null);
  const [copiedTarget, setCopiedTarget] = useState<CopyTarget | null>(null);
  const [connError, setConnError]       = useState(false);
  const matchedRef = useRef(false);

  // Derived values are computed BEFORE the hooks that use them, and the
  // early return for an invalid gameType comes AFTER all hooks.
  const entry     = isGameType(gameType) ? gameRegistry[gameType] : null;
  const GameIcon  = entry ? gameIconMap[entry.iconName] : undefined;
  const shareLink = code ? `${window.location.origin}/join/${code}` : "";

  // ── Socket.io: create room (on every connect), wait for opponent ───────
  useEffect(() => {
    if (!isGameType(gameType)) return;
    matchedRef.current = false;

    const createRoom = () => {
      setConnError(false);
      socket.emit("create_room", { gameType });
    };
    const onRoomCreated = ({ code }: { roomId: string; code: string }) => {
      setCode(code);
    };
    const onMatched = ({ roomId }: { roomId: string }) => {
      matchedRef.current = true;
      navigate(`/game/${gameType}/match/${roomId}`);
    };
    const onConnectError = () => setConnError(true);

    socket.on("connect", createRoom);
    socket.on("connect_error", onConnectError);
    socket.on("room_created", onRoomCreated);
    socket.on("matched", onMatched);

    if (socket.connected) createRoom();
    else socket.connect();

    return () => {
      // Leaving without a match: cancel the waiting room on the server.
      if (!matchedRef.current) socket.emit("cancel_room");
      socket.off("connect", createRoom);
      socket.off("connect_error", onConnectError);
      socket.off("room_created", onRoomCreated);
      socket.off("matched", onMatched);
    };
  }, [gameType, navigate]);

  const handleCopy = useCallback(async (target: CopyTarget) => {
    if (!code) return;
    const text = target === "code" ? code : shareLink;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTarget(target);
      setTimeout(() => setCopiedTarget(null), 2000);
    } catch {
      // Clipboard API blocked — silently ignore
    }
  }, [code, shareLink]);

  const handleShare = useCallback(async () => {
    if (!code) return;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: `Join me in ${entry?.title ?? "AlgoMind"} on AlgoMind!`,
          text:  `Use room code ${code} or click the link to join my game.`,
          url:   shareLink,
        });
        return;
      } catch {
        // User cancelled share sheet — fall through to clipboard copy
      }
    }
    await handleCopy("link");
  }, [entry, code, shareLink, handleCopy]);

  if (!entry) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <p className="text-lg font-semibold text-textPrimary">Unknown game type.</p>
        <button onClick={() => navigate("/")} className="text-sm text-textMuted underline hover:text-textPrimary transition-colors">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const handleCancel = () => {
    navigate(`/game/${gameType}/friends`); // effect cleanup emits cancel_room
  };

  return (
    <motion.div
      className="flex flex-col gap-8 items-center"
      variants={stagger}
      initial="hidden"
      animate="visible"
    >
      <motion.button
        variants={fadeUp}
        onClick={handleCancel}
        className="self-start flex items-center gap-1.5 text-sm text-textMuted hover:text-textPrimary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-node rounded"
        aria-label="Go back"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Back
      </motion.button>

      <motion.div variants={fadeUp} className="w-full max-w-sm">
        <Card className="flex flex-col items-center gap-7 !py-10 !px-8 text-center">

          {GameIcon && (
            <div className="flex items-center gap-2 rounded-full border border-panelBorder bg-background px-3 py-1.5">
              <GameIcon size={13} className="text-node" aria-hidden="true" />
              <span className="text-xs text-textMuted font-medium">{entry.title}</span>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <h1 className="font-sans text-xl font-bold text-textPrimary">Invite a Friend</h1>
            <p className="text-sm text-textMuted">Share this code or link to start a match</p>
          </div>

          <div className="flex flex-col items-center gap-3 w-full">
            <p className="text-xs uppercase tracking-widest text-textMuted">Room code</p>
            <motion.div
              className="rounded-xl border border-panelBorder bg-background px-6 py-4 w-full"
              style={{
                boxShadow: "0 0 0 1px rgba(127,168,255,0.15), inset 0 0 20px rgba(127,168,255,0.04)",
              }}
              aria-label={code ? `Room code: ${code.split("").join(" ")}` : "Generating room code"}
            >
              {code ? (
                <span className="font-mono text-4xl font-bold tracking-[0.25em] text-node" aria-hidden="true">
                  {code}
                </span>
              ) : (
                <span className="font-mono text-sm text-textMuted">Generating code…</span>
              )}
            </motion.div>
          </div>

          <div className="flex flex-col gap-3 w-full">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 380, damping: 22 }}
              onClick={() => handleCopy("code")}
              disabled={!code}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-panelBorder bg-background px-4 py-3 text-sm font-medium text-textPrimary hover:border-node/50 hover:bg-node/5 transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-node"
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

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 380, damping: 22 }}
              onClick={handleShare}
              disabled={!code}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-panelBorder bg-background px-4 py-3 text-sm font-medium text-textPrimary hover:border-gold/50 hover:bg-gold/5 transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              aria-label={typeof navigator !== "undefined" && "share" in navigator ? "Share invite link" : "Copy invite link to clipboard"}
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
                    {typeof navigator !== "undefined" && "share" in navigator ? "Share Link" : "Copy Link"}
                  </span>
                </>
              )}
            </motion.button>
          </div>

          <div className="w-full h-px bg-panelBorder" />

          <div className="flex flex-col items-center gap-4">
            <div className="relative flex items-center justify-center" style={{ width: 56, height: 56 }} aria-hidden="true">
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
              <p className="text-sm font-medium text-textPrimary">Waiting for your friend to join…</p>
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
                <p className="text-xs text-textMuted">Share the code or link above</p>
              )}
            </div>
          </div>

          <Button variant="secondary" onClick={handleCancel} className="w-full">
            Cancel
          </Button>
        </Card>
      </motion.div>

      {shareLink && (
        <motion.p
          variants={fadeUp}
          className="text-xs text-textMuted font-mono break-all text-center max-w-xs"
          aria-label={`Invite link: ${shareLink}`}
        >
          {shareLink}
        </motion.p>
      )}
    </motion.div>
  );
}