/**
 * JoinRoomScreen.tsx
 *
 * Route:  /game/:gameType/join
 * Also reachable via JoinRedirect (/join/:roomCode) which passes a
 * pre-filled code through location.state or the `initialCode` prop.
 *
 * ─── MOCK / TODO ─────────────────────────────────────────────────────────────
 * handleJoin currently accepts any valid 6-character string and navigates
 * directly to a stub match route.
 *
 * Replace the mock submission with:
 *   const { room, error } = await api.post("/api/rooms/join", { code })
 *   if (error) setCodeError("Room not found or has expired.")
 *   else       navigate(`/game/${room.gameType}/match/${room.roomId}`)
 *
 * The room's gameType may differ from the URL param when reaching this page
 * from /join/:roomCode (no gameType in URL). Handle that case by reading the
 * gameType from the API response instead of the URL param.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, AlertCircle } from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
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

// ─── Props ────────────────────────────────────────────────────────────────────
export interface JoinRoomScreenProps {
  /**
   * Pre-filled code passed programmatically (e.g. from JoinRedirect).
   * When provided the input is pre-populated and the form auto-submits.
   */
  initialCode?: string;
}

// ─── Location state shape (passed by JoinRedirect via navigate state) ─────────
interface LocationState {
  initialCode?: string;
  autoSubmit?:  boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function JoinRoomScreen({ initialCode: propCode }: JoinRoomScreenProps = {}) {
  const { gameType } = useParams<{ gameType: string }>();
  const navigate     = useNavigate();
  const location     = useLocation();

  // Accept initialCode from either prop (direct use) or router location state (JoinRedirect)
  const locState    = (location.state ?? {}) as LocationState;
  const seedCode    = propCode ?? locState.initialCode ?? "";
  const autoSubmit  = locState.autoSubmit === true;

  const [code,      setCode]      = useState(seedCode.toUpperCase().slice(0, 6));
  const [codeError, setCodeError] = useState<string | null>(null);
  const [joining,   setJoining]   = useState(false);
  const inputRef                  = useRef<HTMLInputElement>(null);

  // Determine back destination — if gameType is present use game friends page, else home
  const backTo = isGameType(gameType) ? `/game/${gameType}/friends` : "/";

  const entry    = isGameType(gameType) ? gameRegistry[gameType]    : null;
  const GameIcon = entry ? (gameIconMap[entry.iconName] ?? null) : null;

  // ── Core join logic (exported-ish so JoinRedirect can trigger it) ──────────
  const handleJoin = useCallback(async (codeToJoin: string) => {
    const trimmed = codeToJoin.trim().toUpperCase();
    if (trimmed.length !== 6) return;

    setCodeError(null);
    setJoining(true);

    // TODO: REPLACE this mock with a real API call:
    //   try {
    //     const { data } = await axios.post("/api/rooms/join", { code: trimmed });
    //     navigate(`/game/${data.gameType}/match/${data.roomId}`);
    //   } catch (err) {
    //     setCodeError("Room not found or has expired. Check the code and try again.");
    //   } finally {
    //     setJoining(false);
    //   }

    // Mock: accept any 6-char code and navigate to stub match
    // The `gameType` in the URL may be undefined when arriving via /join/:roomCode,
    // so fall back to a placeholder segment — the real API response will supply the type.
    await new Promise((r) => setTimeout(r, 600)); // simulate network latency
    // TODO: replace "mock-room-id" with the real roomId from the API response
    const resolvedGameType = isGameType(gameType) ? gameType : "dijkstra"; // TODO: get from API
    navigate(`/game/${resolvedGameType}/match/mock-room-id`);
    setJoining(false);
  }, [gameType, navigate]);

  // Focus input on mount
  useEffect(() => {
    if (!autoSubmit) inputRef.current?.focus();
  }, []);

  // Auto-submit when a pre-filled code is passed (deep-link flow)
  useEffect(() => {
    if (autoSubmit && seedCode.length === 6) {
      handleJoin(seedCode);
    }
  }, [autoSubmit]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    setCode(val);
    if (codeError) setCodeError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && code.length === 6 && !joining) handleJoin(code);
  };

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
        onClick={() => navigate(backTo)}
        className="self-start flex items-center gap-1.5 text-sm text-textMuted hover:text-textPrimary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-node rounded"
        aria-label="Go back"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Back
      </motion.button>

      {/* Main card */}
      <motion.div variants={fadeUp} className="w-full max-w-sm">
        <Card className="flex flex-col items-center gap-7 !py-10 !px-8 text-center">

          {/* Optional game identity pill */}
          {GameIcon && entry && (
            <div className="flex items-center gap-2 rounded-full border border-panelBorder bg-background px-3 py-1.5">
              <GameIcon size={13} className="text-node" aria-hidden="true" />
              <span className="text-xs text-textMuted font-medium">{entry.title}</span>
            </div>
          )}

          {/* Heading */}
          <div className="flex flex-col gap-1.5">
            <h1 className="font-sans text-xl font-bold text-textPrimary">Enter a room code</h1>
            <p className="text-sm text-textMuted">Type the 6-character code your friend shared</p>
          </div>

          {/* Code input */}
          <div className="flex flex-col items-center gap-3 w-full">
            <motion.div
              animate={codeError ? { x: [-6, 6, -5, 5, 0] } : { x: 0 }}
              transition={{ duration: 0.35 }}
              className="w-full"
            >
              <input
                ref={inputRef}
                type="text"
                inputMode="text"
                value={code}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                maxLength={6}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                aria-label="Room code"
                aria-describedby={codeError ? "join-error" : undefined}
                aria-invalid={codeError ? "true" : "false"}
                disabled={joining}
                placeholder="––––––"
                style={{
                  width:       "100%",
                  background:  "#060709",
                  border:      `2px solid ${codeError ? "#FF6B8A" : code.length === 6 ? "#7FA8FF" : "#2A3166"}`,
                  borderRadius: 12,
                  padding:     "14px 20px",
                  fontFamily:  "JetBrains Mono, monospace",
                  fontSize:    "2rem",
                  fontWeight:  700,
                  textAlign:   "center",
                  letterSpacing: "0.3em",
                  color:       codeError ? "#FF6B8A" : code.length === 6 ? "#7FA8FF" : "#E8ECFB",
                  caretColor:  "#7FA8FF",
                  outline:     "none",
                  transition:  "border-color 0.2s, color 0.2s",
                  boxShadow:   code.length === 6 && !codeError
                    ? "0 0 0 1px rgba(127,168,255,0.2), inset 0 0 16px rgba(127,168,255,0.06)"
                    : "none",
                  opacity:     joining ? 0.5 : 1,
                }}
              />
            </motion.div>

            {/* Character count hint */}
            <p className="text-xs text-textMuted tabular-nums" aria-live="polite">
              {code.length} / 6 characters
            </p>

            {/* Inline error message — structured but unreachable with mock; ready for real API */}
            <AnimatePresence>
              {codeError && (
                <motion.div
                  id="join-error"
                  role="alert"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{    opacity: 0, height: 0      }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 w-full text-left overflow-hidden"
                  style={{
                    borderColor: "rgba(255,107,138,0.35)",
                    background:  "rgba(255,107,138,0.07)",
                  }}
                >
                  <AlertCircle size={14} style={{ color: "#FF6B8A", flexShrink: 0 }} aria-hidden="true" />
                  <span className="text-xs font-medium" style={{ color: "#FF6B8A" }}>
                    {codeError}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Join button */}
          <Button
            variant="primary"
            onClick={() => handleJoin(code)}
            disabled={code.length !== 6 || joining}
            className="w-full"
            aria-busy={joining}
          >
            {joining ? "Joining…" : "Join Room"}
          </Button>
        </Card>
      </motion.div>
    </motion.div>
  );
}
