/**
 * JoinRedirect.tsx
 *
 * Route: /join/:roomCode  (protected — only rendered for logged-in users)
 *
 * Deep-link entry point. A friend clicks a link like:
 *   https://algomind.app/join/ABC123
 *
 * Because this route is wrapped in ProtectedRoute, unauthenticated visitors
 * are automatically redirected to /login with state.from set to this URL.
 * After login they are sent back here and the join flow completes.
 *
 * Behaviour (always logged in by the time this renders):
 *   Navigates immediately to JoinRoomScreen with the code pre-filled and
 *   auto-submitted, so the user never has to type anything.
 */

import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import GlowNode from "../components/ui/GlowNode";

export default function JoinRedirect() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate     = useNavigate();

  useEffect(() => {
    if (!roomCode) {
      navigate("/");
      return;
    }

    // Forward to JoinRoomScreen with the code pre-filled and auto-submitted.
    // No auth check needed — ProtectedRoute handles that before we render.
    navigate("/join-room", {
      replace: true,
      state: {
        initialCode: roomCode.toUpperCase().slice(0, 6),
        autoSubmit:  true,
      },
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Loading screen shown briefly while the redirect fires ─────────────────
  return (
    <div className="flex flex-col items-center justify-center gap-6 min-h-[60vh]">
      <div
        className="relative flex items-center justify-center"
        style={{ width: 64, height: 64 }}
        aria-hidden="true"
      >
        {[0, 1].map((i) => (
          <motion.span
            key={i}
            className="absolute rounded-full border border-gold"
            style={{ width: 64, height: 64 }}
            animate={{ scale: [1, 2.4], opacity: [0.5, 0] }}
            transition={{ duration: 1.8, ease: "easeOut", repeat: Infinity, delay: i * 0.75 }}
          />
        ))}
        <GlowNode color="gold" size={32}>
          <span className="rounded-full bg-panel" style={{ width: 16, height: 16 }} />
        </GlowNode>
      </div>

      <div className="flex flex-col items-center gap-1 text-center">
        <p className="font-sans text-base font-semibold text-textPrimary">
          Joining room…
        </p>
        <p className="text-sm text-textMuted font-mono">
          {roomCode?.toUpperCase()}
        </p>
      </div>
    </div>
  );
}
