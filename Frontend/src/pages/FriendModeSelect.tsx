/**
 * FriendModeSelect.tsx
 *
 * Route: /game/:gameType/friends
 *
 * Two top-level cards:
 *   • Random Opponent  → /game/:gameType/queue
 *   • Invite a Friend  → expands inline to two sub-options:
 *       – Create a Room  → /game/:gameType/invite  (host, share a code)
 *       – Enter a Code   → /game/:gameType/join    (join with a code)
 */

import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Shuffle, Link2, ArrowLeft, Box, Plus, KeyRound, ChevronDown } from "lucide-react";
import Card from "../components/ui/Card";
import { gameRegistry, isGameType } from "../config/gameRegistry";
import { gameIconMap } from "../config/gameIconMap";

// ─── Animation variants ───────────────────────────────────────────────────────
const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0  },
};

const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

const expandVariant = {
  hidden:  { opacity: 0, height: 0  },
  visible: { opacity: 1, height: "auto" },
};

// ─── Sub-option card ──────────────────────────────────────────────────────────
interface SubOption {
  id:      "invite" | "join";
  label:   string;
  subtext: string;
  Icon:    React.ElementType;
  accent:  "node" | "teal";
}

const SUB_OPTIONS: SubOption[] = [
  {
    id:      "invite",
    label:   "Create a Room",
    subtext: "Get a code to share with your friend",
    Icon:    Plus,
    accent:  "node",
  },
  {
    id:      "join",
    label:   "Enter a Code",
    subtext: "You already have a code from a friend",
    Icon:    KeyRound,
    accent:  "teal",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function FriendModeSelect() {
  const { gameType } = useParams<{ gameType: string }>();
  const navigate      = useNavigate();

  // Tracks whether the "Invite a Friend" card is expanded to show sub-options
  const [inviteExpanded, setInviteExpanded] = useState(false);

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

  const entry    = gameRegistry[gameType];
  const GameIcon = gameIconMap[entry.iconName] ?? Box;

  const handleSubOption = (id: SubOption["id"]) => {
    if (id === "invite") navigate(`/game/${gameType}/invite`);
    else                 navigate(`/game/${gameType}/join`);
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
        onClick={() => navigate(`/game/${gameType}`)}
        className="flex items-center gap-1.5 w-fit text-sm text-textMuted hover:text-textPrimary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-node rounded"
        aria-label={`Back to ${entry.title} mode selection`}
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Back
      </motion.button>

      {/* Game identity header */}
      <motion.div variants={fadeUp} className="flex flex-col items-center gap-4 text-center">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl border border-panelBorder bg-panel shadow-glow-node"
          aria-hidden="true"
        >
          <GameIcon size={32} className="text-node" />
        </div>
        <div>
          <h1 className="font-sans text-3xl font-bold text-textPrimary">{entry.title}</h1>
          <p className="mt-1 text-sm text-textMuted">Play with Friends</p>
        </div>
        <p className="text-xs uppercase tracking-widest text-textMuted">
          Choose how to find an opponent
        </p>
      </motion.div>

      {/* Top-level option cards */}
      <motion.div variants={stagger} className="flex flex-col gap-4">

        {/* ── Card 1: Random Opponent ──────────────────────────────────── */}
        <motion.div variants={fadeUp}>
          <motion.button
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 280, damping: 22 }}
            onClick={() => navigate(`/game/${gameType}/queue`)}
            className="group w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-node focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl"
            aria-label="Random Opponent"
          >
            <Card className="flex items-center gap-5 !p-6 cursor-pointer border transition-all duration-300">
              {/* Icon */}
              <div
                className="shrink-0 flex h-12 w-12 items-center justify-center rounded-xl border border-panelBorder bg-background transition-colors duration-300 group-hover:border-teal/50 group-hover:shadow-glow-teal"
                aria-hidden="true"
              >
                <Shuffle size={22} className="text-textMuted transition-colors duration-300 group-hover:text-teal" />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="font-sans text-base font-semibold text-textPrimary transition-colors duration-300 group-hover:text-teal">
                  Random Opponent
                </p>
                <p className="mt-0.5 text-sm text-textMuted">
                  Get matched with whoever's online
                </p>
              </div>

              {/* Arrow */}
              <span className="font-mono text-textMuted group-hover:text-teal transition-colors duration-300 shrink-0" aria-hidden="true">
                →
              </span>
            </Card>
          </motion.button>
        </motion.div>

        {/* ── Card 2: Invite a Friend (expandable) ─────────────────────── */}
        <motion.div variants={fadeUp}>
          {/* Top row — always visible, toggles expansion */}
          <button
            onClick={() => setInviteExpanded((v) => !v)}
            className="group w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-node focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl"
            aria-expanded={inviteExpanded}
            aria-controls="invite-suboptions"
            aria-label="Invite a Friend — expand options"
          >
            <Card
              className={[
                "flex items-center gap-5 !p-6 cursor-pointer border transition-all duration-300",
                inviteExpanded ? "border-node/40 rounded-b-none" : "",
              ].join(" ")}
            >
              {/* Icon */}
              <div
                className={[
                  "shrink-0 flex h-12 w-12 items-center justify-center rounded-xl border bg-background transition-colors duration-300",
                  inviteExpanded
                    ? "border-node/50 shadow-glow-node"
                    : "border-panelBorder group-hover:border-node/50 group-hover:shadow-glow-node",
                ].join(" ")}
                aria-hidden="true"
              >
                <Link2
                  size={22}
                  className={[
                    "transition-colors duration-300",
                    inviteExpanded ? "text-node" : "text-textMuted group-hover:text-node",
                  ].join(" ")}
                />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p
                  className={[
                    "font-sans text-base font-semibold transition-colors duration-300",
                    inviteExpanded ? "text-node" : "text-textPrimary group-hover:text-node",
                  ].join(" ")}
                >
                  Invite a Friend
                </p>
                <p className="mt-0.5 text-sm text-textMuted">
                  {inviteExpanded ? "Choose an option below" : "Send a code or link to a friend"}
                </p>
              </div>

              {/* Chevron */}
              <motion.span
                animate={{ rotate: inviteExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="shrink-0"
                aria-hidden="true"
              >
                <ChevronDown
                  size={18}
                  className={inviteExpanded ? "text-node" : "text-textMuted group-hover:text-node"}
                />
              </motion.span>
            </Card>
          </button>

          {/* Expandable sub-options panel */}
          <AnimatePresence initial={false}>
            {inviteExpanded && (
              <motion.div
                id="invite-suboptions"
                key="invite-suboptions"
                variants={expandVariant}
                initial="hidden"
                animate="visible"
                exit="hidden"
                transition={{ duration: 0.22, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div
                  className="grid grid-cols-1 gap-0 sm:grid-cols-2 rounded-b-xl border border-t-0 border-node/40 overflow-hidden"
                  style={{ background: "rgba(13,17,48,0.7)" }}
                >
                  {SUB_OPTIONS.map((sub, idx) => {
                    const isNode = sub.accent === "node";
                    return (
                      <motion.button
                        key={sub.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.07, duration: 0.18 }}
                        whileHover={{ backgroundColor: isNode ? "rgba(127,168,255,0.06)" : "rgba(110,231,196,0.06)" }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleSubOption(sub.id)}
                        className={[
                          "group flex items-center gap-4 p-5 text-left w-full",
                          "focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2",
                          isNode ? "focus-visible:ring-node" : "focus-visible:ring-teal",
                          // right border between the two columns on sm+
                          idx === 0 ? "sm:border-r sm:border-panelBorder" : "",
                        ].join(" ")}
                        aria-label={sub.label}
                      >
                        {/* Sub-option icon */}
                        <div
                          className={[
                            "shrink-0 flex h-10 w-10 items-center justify-center rounded-lg border bg-background transition-colors duration-200",
                            isNode
                              ? "border-panelBorder group-hover:border-node/60"
                              : "border-panelBorder group-hover:border-teal/60",
                          ].join(" ")}
                          aria-hidden="true"
                        >
                          <sub.Icon
                            size={18}
                            className={[
                              "transition-colors duration-200",
                              isNode ? "text-textMuted group-hover:text-node" : "text-textMuted group-hover:text-teal",
                            ].join(" ")}
                          />
                        </div>

                        {/* Sub-option text */}
                        <div className="min-w-0">
                          <p
                            className={[
                              "font-sans text-sm font-semibold transition-colors duration-200",
                              isNode ? "text-textPrimary group-hover:text-node" : "text-textPrimary group-hover:text-teal",
                            ].join(" ")}
                          >
                            {sub.label}
                          </p>
                          <p className="mt-0.5 text-xs text-textMuted leading-snug">
                            {sub.subtext}
                          </p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

      </motion.div>

      {/* Breadcrumb */}
      <motion.p variants={fadeUp} className="text-center text-xs text-textMuted">
        <span className="text-textPrimary">{entry.title}</span>
        {" · "}
        Play with Friends
      </motion.p>
    </motion.div>
  );
}
