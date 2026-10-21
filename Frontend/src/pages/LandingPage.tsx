/**
 * LandingPage.tsx
 *
 * Route: /
 * Own layout — no Navbar, no AppLayout wrapper.
 * Sections: TopBar → Hero + Constellation → How It Works → Games → CTA + Footer
 */

import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles, GitBranch, Swords, Trophy, Box } from "lucide-react";
import StarfieldBackground from "../components/StarfieldBackground";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { gameRegistryList } from "../config/gameRegistry";
import { gameIconMap } from "../config/gameIconMap";
import { useAuth } from "../context/AuthContext";

// ─── Animation helpers ────────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0  },
};

const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

const inViewProps = {
  initial:    "hidden" as const,
  whileInView: "visible" as const,
  viewport:   { once: true, margin: "-60px" },
};

// ─── Constellation SVG ────────────────────────────────────────────────────────
// 8 nodes, hand-tuned positions that look good in the viewport space.
// The gold path animates its pathLength from 0→1, then loops.

const NODES = [
  { id: "S",  cx: 60,  cy: 80  },
  { id: "A",  cx: 170, cy: 30  },
  { id: "B",  cx: 290, cy: 70  },
  { id: "C",  cx: 200, cy: 155 },
  { id: "D",  cx: 80,  cy: 195 },
  { id: "E",  cx: 330, cy: 185 },
  { id: "F",  cx: 250, cy: 260 },
  { id: "T",  cx: 370, cy: 290 },
] as const;

// Edges between nodes (background lines)
const EDGES: [string, string][] = [
  ["S","A"], ["S","D"], ["A","B"], ["A","C"],
  ["B","C"], ["B","E"], ["C","D"], ["C","F"],
  ["D","F"], ["E","T"], ["F","T"],
];

// The gold shortest-path: S → A → B → E → T
const PATH_D = `M ${NODES[0].cx} ${NODES[0].cy}
                L ${NODES[1].cx} ${NODES[1].cy}
                L ${NODES[2].cx} ${NODES[2].cy}
                L ${NODES[6].cx} ${NODES[6].cy}
                L ${NODES[7].cx} ${NODES[7].cy}`;

function Constellation() {
  const prefersReduced = useReducedMotion();

  const pulseAnim = prefersReduced
    ? {}
    : {
        animate: { r: [8, 11, 8] as number[] },
        transition: { duration: 2.4, repeat: Infinity, ease: "easeInOut" as const },
      };

  const pathAnim = prefersReduced
    ? { pathLength: 1 }
    : {
        initial:    { pathLength: 0, opacity: 0 },
        animate:    { pathLength: [0, 1, 1, 0], opacity: [0, 1, 1, 0] },
        transition: {
          duration:   3.6,
          repeat:     Infinity,
          repeatDelay: 1.2,
          ease:       "easeInOut" as const,
          times:      [0, 0.45, 0.75, 1],
        },
      };

  // Build edge lookup for positions
  const nodeMap = Object.fromEntries(NODES.map((n) => [n.id, n]));

  return (
    <svg
      viewBox="0 0 430 330"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="w-full max-w-[430px] select-none"
      style={{ overflow: "visible" }}
    >
      {/* Background connection lines */}
      {EDGES.map(([a, b]) => {
        const na = nodeMap[a];
        const nb = nodeMap[b];
        return (
          <line
            key={`${a}-${b}`}
            x1={na.cx} y1={na.cy}
            x2={nb.cx} y2={nb.cy}
            stroke="#2A3166"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        );
      })}

      {/* Gold shortest-path trace */}
      <motion.path
        d={PATH_D}
        fill="none"
        stroke="#FFD36E"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: "drop-shadow(0 0 5px #FFD36E99)" }}
        {...pathAnim}
      />

      {/* Nodes */}
      {NODES.map((node) => {
        const isEndpoint = node.id === "S" || node.id === "T";
        const isPath     = ["S","A","B","E","T"].includes(node.id);
        const fill       = isEndpoint ? "#FFD36E" : isPath ? "#7FA8FF" : "#1B2147";
        const stroke     = isEndpoint ? "#FFD36E" : isPath ? "#7FA8FF" : "#2A3166";

        return (
          <g key={node.id}>
            {/* Outer glow ring for path nodes */}
            {isPath && !prefersReduced && (
              <motion.circle
                cx={node.cx} cy={node.cy}
                r={8}
                fill="none"
                stroke={isEndpoint ? "#FFD36E" : "#7FA8FF"}
                strokeWidth="1"
                opacity={0.35}
                {...pulseAnim}
              />
            )}
            {/* Node circle */}
            <circle
              cx={node.cx} cy={node.cy}
              r={isEndpoint ? 12 : 8}
              fill={fill}
              stroke={stroke}
              strokeWidth={isEndpoint ? 2 : 1.5}
              style={isEndpoint
                ? { filter: "drop-shadow(0 0 8px #FFD36E88)" }
                : isPath
                  ? { filter: "drop-shadow(0 0 5px #7FA8FF55)" }
                  : undefined
              }
            />
            {/* Label */}
            <text
              x={node.cx} y={node.cy + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={isEndpoint ? 10 : 8}
              fontWeight="700"
              fontFamily="monospace"
              fill={isEndpoint ? "#060709" : "#E8ECFB"}
            >
              {node.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── How it works data ────────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  {
    step: "01",
    Icon: GitBranch,
    title: "Pick a game",
    body:  "Choose from algorithm challenges: Dijkstra, BST, Floyd-Warshall and more.",
    color: "text-node",
    glow:  "shadow-glow-node",
  },
  {
    step: "02",
    Icon: Swords,
    title: "Battle live in 60 seconds",
    body:  "Both players get the same graph. Race to complete the most rounds correctly.",
    color: "text-gold",
    glow:  "shadow-glow-gold",
  },
  {
    step: "03",
    Icon: Trophy,
    title: "Climb the leaderboard",
    body:  "Win matches to earn XP, build your streak, and rise through the global rankings.",
    color: "text-teal",
    glow:  "shadow-glow-teal",
  },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const { user } = useAuth();   // loading is intentionally ignored — never block render
  const gamesRef = useRef<HTMLElement>(null);

  return (
    <>
      <StarfieldBackground />

      <div className="relative z-0 flex flex-col min-h-screen text-textPrimary">

        {/* ════════════════════════════════════════════════════════════════
            A) TOP BAR
        ════════════════════════════════════════════════════════════════ */}
        <header className="sticky top-0 z-50 w-full border-b border-panelBorder bg-panel/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
            {/* Logo */}
            <Link
              to="/"
              className="flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded"
              aria-label="AlgoMind — home"
            >
              <Sparkles
                size={20}
                className="text-gold drop-shadow-[0_0_6px_#FFD36E] group-hover:animate-twinkle"
                aria-hidden="true"
              />
              <span className="font-sans text-xl font-bold tracking-tight text-gold drop-shadow-[0_0_8px_#FFD36E99]">
                AlgoMind
              </span>
            </Link>

            {/* Auth buttons — adapts to login state */}
            <nav className="flex items-center gap-2" aria-label="Account navigation">
              {user ? (
                <Link to="/dashboard" tabIndex={-1}>
                  <Button variant="primary" className="min-h-[44px] min-w-[80px]">
                    Go to dashboard
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/login" tabIndex={-1}>
                    <Button variant="secondary" className="min-h-[44px] min-w-[80px]">
                      Log in
                    </Button>
                  </Link>
                  <Link to="/signup" tabIndex={-1}>
                    <Button variant="primary" className="min-h-[44px] min-w-[80px]">
                      Sign up
                    </Button>
                  </Link>
                </>
              )}
            </nav>
          </div>
        </header>

        {/* ════════════════════════════════════════════════════════════════
            B) HERO
        ════════════════════════════════════════════════════════════════ */}
        <section
          aria-label="Hero"
          className="mx-auto w-full max-w-7xl px-4 sm:px-6 pt-20 pb-24 lg:pt-28"
        >
          <div className="flex flex-col-reverse items-center gap-12 lg:flex-row lg:items-center lg:gap-16">

            {/* Text column */}
            <motion.div
              className="flex flex-col gap-8 lg:max-w-xl"
              variants={stagger}
              {...inViewProps}
            >
              <motion.div variants={fadeUp} className="flex flex-col gap-4">
                <h1 className="font-sans text-4xl font-extrabold leading-tight tracking-tight text-textPrimary sm:text-5xl lg:text-6xl">
                  Learn algorithms{" "}
                  <span
                    className="text-gold"
                    style={{ textShadow: "0 0 24px #FFD36E55" }}
                  >
                    by playing.
                  </span>
                </h1>
                <p className="font-sans text-base text-textMuted leading-relaxed sm:text-lg max-w-lg">
                  Race real opponents in 60-second live battles. Master Dijkstra,
                  trees and more.
                </p>
              </motion.div>

              <motion.div variants={fadeUp} className="flex flex-col gap-4 sm:flex-row sm:items-center">
                {user ? (
                  <Link to="/dashboard" tabIndex={-1}>
                    <Button
                      variant="primary"
                      className="min-h-[48px] px-8 text-base font-bold w-full sm:w-auto"
                    >
                      Start Playing
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link to="/signup" tabIndex={-1}>
                      <Button
                        variant="primary"
                        className="min-h-[48px] px-8 text-base font-bold w-full sm:w-auto"
                      >
                        Start Playing
                      </Button>
                    </Link>
                    <Link
                      to="/login"
                      className="text-sm text-textMuted hover:text-textPrimary transition-colors text-center underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-node rounded min-h-[44px] flex items-center justify-center"
                    >
                      I already have an account
                    </Link>
                  </>
                )}
              </motion.div>
            </motion.div>

            {/* Constellation column */}
            <motion.div
              className="w-full max-w-sm lg:max-w-none lg:flex-1"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1  }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
            >
              <Constellation />
            </motion.div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            C) HOW IT WORKS
        ════════════════════════════════════════════════════════════════ */}
        <section
          aria-labelledby="how-heading"
          className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-20 border-t border-panelBorder/50"
        >
          <motion.div
            className="flex flex-col gap-10"
            variants={stagger}
            {...inViewProps}
          >
            <motion.div variants={fadeUp} className="text-center">
              <span className="text-xs uppercase tracking-widest text-textMuted">How it works</span>
              <h2
                id="how-heading"
                className="mt-2 font-sans text-2xl font-bold text-textPrimary sm:text-3xl"
              >
                Three steps to the top
              </h2>
            </motion.div>

            <motion.div
              variants={stagger}
              className="grid grid-cols-1 gap-6 sm:grid-cols-3"
            >
              {HOW_IT_WORKS.map(({ step, Icon, title, body, color, glow }) => (
                <motion.div key={step} variants={fadeUp}>
                  <Card className="flex flex-col gap-5 h-full">
                    <div className="flex items-start justify-between">
                      {/* Icon badge */}
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-xl border border-panelBorder bg-background ${glow}`}
                        aria-hidden="true"
                      >
                        <Icon size={22} className={color} />
                      </div>
                      {/* Step number */}
                      <span className="font-mono text-3xl font-black text-panelBorder select-none">
                        {step}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <h3 className="font-sans text-base font-semibold text-textPrimary">
                        {title}
                      </h3>
                      <p className="font-sans text-sm text-textMuted leading-relaxed">
                        {body}
                      </p>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            D) GAMES GRID
        ════════════════════════════════════════════════════════════════ */}
        <section
          ref={gamesRef}
          aria-labelledby="games-heading"
          className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-20 border-t border-panelBorder/50"
        >
          <motion.div
            className="flex flex-col gap-10"
            variants={stagger}
            {...inViewProps}
          >
            <motion.div variants={fadeUp} className="text-center">
              <span className="text-xs uppercase tracking-widest text-textMuted">Games</span>
              <h2
                id="games-heading"
                className="mt-2 font-sans text-2xl font-bold text-textPrimary sm:text-3xl"
              >
                What you'll master
              </h2>
            </motion.div>

            <motion.div
              variants={stagger}
              className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
            >
              {gameRegistryList.map((entry) => {
                const isLive  = entry.routeKey === "dijkstra";
                const Icon    = gameIconMap[entry.iconName] ?? Box;

                const inner = (
                  <Card
                    className={[
                      "flex flex-col gap-4 h-full transition-all duration-300",
                      isLive  ? "hover:border-teal/60" : "opacity-50",
                    ].join(" ")}
                  >
                    {/* Header row: icon + badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className={[
                          "flex h-10 w-10 items-center justify-center rounded-lg border border-panelBorder bg-background transition-colors duration-300",
                          isLive ? "group-hover:border-teal/50" : "",
                        ].join(" ")}
                        aria-hidden="true"
                      >
                        <Icon
                          size={20}
                          className={isLive ? "text-node" : "text-textMuted"}
                        />
                      </div>

                      {isLive ? (
                        /* "Live" badge */
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                          style={{
                            background: "rgba(110,231,196,0.12)",
                            color:      "#6EE7C4",
                            border:     "1px solid rgba(110,231,196,0.35)",
                          }}
                          aria-label="Live — available to play"
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-teal"
                            style={{ boxShadow: "0 0 4px #6EE7C4" }}
                            aria-hidden="true"
                          />
                          Live
                        </span>
                      ) : (
                        /* "Coming soon" badge */
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                          style={{
                            background: "rgba(41,49,102,0.5)",
                            color:      "#9199B5",
                            border:     "1px solid #2A3166",
                          }}
                          aria-label="Coming soon"
                        >
                          Coming soon
                        </span>
                      )}
                    </div>

                    {/* Text */}
                    <div className="flex flex-col gap-1.5">
                      <h3 className="font-sans text-sm font-semibold text-textPrimary leading-snug">
                        {entry.title}
                      </h3>
                      <p className="font-sans text-xs text-textMuted leading-relaxed">
                        {entry.description}
                      </p>
                    </div>
                  </Card>
                );

                return isLive ? (
                  <motion.div key={entry.routeKey} variants={fadeUp} className="group">
                    <Link
                      to="/signup"
                      className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl"
                      aria-label={`Play ${entry.title}`}
                    >
                      {inner}
                    </Link>
                  </motion.div>
                ) : (
                  <motion.div
                    key={entry.routeKey}
                    variants={fadeUp}
                    aria-label={`${entry.title} — coming soon`}
                  >
                    {inner}
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            E) CTA BAND + FOOTER
        ════════════════════════════════════════════════════════════════ */}
        <section
          aria-labelledby="cta-heading"
          className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-20 border-t border-panelBorder/50"
        >
          <motion.div
            className="flex flex-col items-center gap-8 text-center"
            variants={stagger}
            {...inViewProps}
          >
            <motion.div variants={fadeUp} className="flex flex-col gap-3 max-w-lg">
              <h2
                id="cta-heading"
                className="font-sans text-3xl font-extrabold text-textPrimary sm:text-4xl"
              >
                Ready to play?
              </h2>
              <p className="text-textMuted text-sm sm:text-base leading-relaxed">
                Join thousands of players solving algorithms under pressure.
                Your first match is free.
              </p>
            </motion.div>

            <motion.div variants={fadeUp}>
              <Link to="/signup" tabIndex={-1}>
                <Button
                  variant="primary"
                  className="min-h-[52px] px-10 text-base font-bold"
                >
                  Create a free account
                </Button>
              </Link>
            </motion.div>

            <motion.p variants={fadeUp} className="text-xs text-textMuted">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-node hover:brightness-125 underline underline-offset-2 transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-node rounded"
              >
                Log in
              </Link>
            </motion.p>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="border-t border-panelBorder/50 py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-gold" aria-hidden="true" />
              <span className="font-sans text-sm font-semibold text-gold">AlgoMind</span>
            </div>
            <p className="text-xs text-textMuted">
              © {new Date().getFullYear()} AlgoMind. All rights reserved.
            </p>
            <nav className="flex items-center gap-4" aria-label="Footer links">
              <Link
                to="/login"
                className="text-xs text-textMuted hover:text-textPrimary transition-colors focus-visible:outline-none focus-visible:underline"
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="text-xs text-textMuted hover:text-textPrimary transition-colors focus-visible:outline-none focus-visible:underline"
              >
                Sign up
              </Link>
            </nav>
          </div>
        </footer>

      </div>
    </>
  );
}
