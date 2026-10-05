/**
 * JoinRedirect.tsx
 *
 * Route: /join/:roomCode
 *
 * Deep-link entry point. A friend clicks a link like:
 *   https://algomind.app/join/ABC123
 *
 * Behaviour:
 *   • Logged in  — navigates immediately to JoinRoomScreen with the code
 *                  pre-filled and auto-submitted, so the user never has to
 *                  type anything.
 *   • Not logged in — redirects to /login first.
 *                     TODO: after successful login, redirect back to this URL
 *                     so the join flow completes automatically.
 *
 * ─── AUTH TODO ───────────────────────────────────────────────────────────────
 * Auth check currently assumes the user is always logged in (isLoggedIn = true).
 * Replace with your real auth state:
 *   const { user } = useAuthContext();          // from your AuthContext / store
 *   const isLoggedIn = user !== null;
 *
 * Redirect-after-login pattern:
 *   navigate("/login", { state: { returnTo: `/join/${roomCode}` } })
 * Then in your login page read location.state.returnTo and redirect there
 * on successful login.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import GlowNode from "../components/ui/GlowNode";

// ─── Component ────────────────────────────────────────────────────────────────
export default function JoinRedirect() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate     = useNavigate();

  useEffect(() => {
    if (!roomCode) {
      navigate("/");
      return;
    }

    // ── Auth check ─────────────────────────────────────────────────────────
    // TODO: replace with real auth state from your AuthContext / store:
    //   const { user } = useAuthContext();
    //   const isLoggedIn = user !== null;
    const isLoggedIn = true; // TODO: remove this stub

    if (!isLoggedIn) {
      // TODO: navigate to login and pass the return destination so the login
      // page can redirect back here after successful authentication:
      //   navigate("/login", { state: { returnTo: `/join/${roomCode}` } });
      navigate("/login");
      return;
    }

    // ── Logged-in path ────────────────────────────────────────────────────
    // Forward to JoinRoomScreen (without a specific gameType in the URL, since
    // we don't know it yet — the room lookup will resolve it).
    // We pass the code via router location state so JoinRoomScreen can
    // pre-fill the input AND auto-submit without the user typing anything.
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
      {/* Pulsing node while redirect happens */}
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
