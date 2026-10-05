/**
 * GameModeSelect.tsx
 *
 * Route: /game/:gameType
 *
 * Shows the game title + icon, then two large mode cards:
 *   • Play Alone   — navigates to the solo route (stub)
 *   • Play with Friends — navigates to /game/:gameType/friends
 */

import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { User, Users, ArrowLeft, Box } from "lucide-react";
import Card from "../components/ui/Card";
import { gameRegistry, isGameType } from "../config/gameRegistry";
import { gameIconMap } from "../config/gameIconMap";

// ─── Animation variants ────────────────────────────────────────────────────────
const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0  },
};

const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

// ─── Mode option data ──────────────────────────────────────────────────────────
interface ModeOption {
  id:      "solo" | "friends";
  label:   string;
  subtext: string;
  Icon:    React.ElementType;
  /** Tailwind accent classes applied on hover */
  accent:  string;
  /** Inline glow colour used for the border-glow shadow */
  glowRgb: string;
}

const MODE_OPTIONS: ModeOption[] = [
  {
    id:      "solo",
    label:   "Play Alone",
    subtext: "Practice at your own pace, race the clock",
    Icon:    User,
    accent:  "group-hover:border-node/70 group-hover:text-node",
    glowRgb: "127,168,255",
  },
  {
    id:      "friends",
    label:   "Play with Friends",
    subtext: "Challenge someone live",
    Icon:    Users,
    accent:  "group-hover:border-gold/70 group-hover:text-gold",
    glowRgb: "255,211,110",
  },
];

// ─── Component ─────────────────────────────────────────────────────────────────
export default function GameModeSelect() {
  const { gameType } = useParams<{ gameType: string }>();
  const navigate      = useNavigate();

  // Guard — unknown gameType falls back gracefully
  if (!isGameType(gameType)) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <p className="text-lg font-semibold text-textPrimary">Unknown game type.</p>
        <button
          onClick={() => navigate("/")}
          className="text-sm text-textMuted underline hover:text-textPrimary transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const entry     = gameRegistry[gameType];
  const GameIcon  = gameIconMap[entry.iconName] ?? Box;

  const handleMode = (mode: ModeOption["id"]) => {
    if (mode === "friends") {
      navigate(`/game/${gameType}/friends`);
    } else {
      // TODO: navigate to solo game wrapper once it is built
      navigate(`/game/${gameType}/solo`);
    }
  };

  return (
    <motion.div
      className="flex flex-col gap-10 max-w-2xl mx-auto"
      variants={stagger}
      initial="hidden"
      animate="visible"
    >
      {/* Back link */}
      <motion.button
        variants={fadeUp}
        onClick={() => navigate("/")}
        className="flex items-center gap-1.5 w-fit text-sm text-textMuted hover:text-textPrimary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-node rounded"
        aria-label="Back to dashboard"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Back to Dashboard
      </motion.button>

      {/* Game identity header */}
      <motion.div variants={fadeUp} className="flex flex-col items-center gap-4 text-center">
        {/* Icon badge */}
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl border border-panelBorder bg-panel shadow-glow-node"
          aria-hidden="true"
        >
          <GameIcon size={32} className="text-node" />
        </div>

        <div>
          <h1 className="font-sans text-3xl font-bold text-textPrimary">
            {entry.title}
          </h1>
          <p className="mt-2 text-sm text-textMuted max-w-sm mx-auto">
            {entry.description}
          </p>
        </div>

        <p className="text-xs uppercase tracking-widest text-textMuted">
          Choose how you want to play
        </p>
      </motion.div>

      {/* Mode cards */}
      <motion.div
        variants={stagger}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        {MODE_OPTIONS.map((opt) => (
          <motion.div key={opt.id} variants={fadeUp}>
            <motion.button
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 280, damping: 22 }}
              onClick={() => handleMode(opt.id)}
              className="group w-full h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-node focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl"
              aria-label={opt.label}
            >
              <Card
                className={[
                  "flex flex-col items-center gap-5 !p-8 text-center cursor-pointer",
                  "border transition-all duration-300",
                  // hover border glow via inline style below
                ].join(" ")}
                style={{
                  // We apply the glow via a CSS variable trick so it reacts to
                  // the group-hover state through JS — simpler than a Tailwind
                  // arbitrary variant here.
                  transition: "border-color 0.25s, box-shadow 0.25s",
                }}
                // Hover effects are driven by Framer Motion (y lift) + CSS group-hover
              >
                {/* Icon */}
                <div
                  className={[
                    "flex h-14 w-14 items-center justify-center rounded-xl",
                    "border border-panelBorder bg-background",
                    "transition-colors duration-300",
                    opt.id === "solo"
                      ? "group-hover:border-node/50 group-hover:shadow-glow-node"
                      : "group-hover:border-gold/50 group-hover:shadow-glow-gold",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  <opt.Icon
                    size={26}
                    className={[
                      "transition-colors duration-300",
                      opt.id === "solo" ? "text-node group-hover:text-node" : "text-textMuted group-hover:text-gold",
                    ].join(" ")}
                  />
                </div>

                {/* Text */}
                <div className="flex flex-col gap-1.5">
                  <span
                    className={[
                      "font-sans text-lg font-bold transition-colors duration-300",
                      opt.id === "solo" ? "text-textPrimary group-hover:text-node" : "text-textPrimary group-hover:text-gold",
                    ].join(" ")}
                  >
                    {opt.label}
                  </span>
                  <span className="font-sans text-sm text-textMuted leading-relaxed">
                    {opt.subtext}
                  </span>
                </div>

                {/* Arrow hint */}
                <span
                  className={[
                    "font-mono text-xs transition-colors duration-300",
                    opt.id === "solo" ? "text-textMuted group-hover:text-node" : "text-textMuted group-hover:text-gold",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  →
                </span>
              </Card>
            </motion.button>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}
