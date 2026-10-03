import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Route,
  GitBranch,
  Grid3x3,
  Calculator,
  Brain,
  Trophy,
  Medal,
} from "lucide-react";
import Card from "../components/ui/Card";

// ─── Mock data (TODO: replace with API calls) ────────────────────────────────

const USERNAME = "Alex"; // TODO: pull from auth context / user API

const STATS = [
  { label: "Rank",      value: "#14",  color: "text-textPrimary" },
  { label: "Accuracy",  value: "92%",  color: "text-teal"        },
  { label: "XP Today",  value: "+340", color: "text-gold"        },
] as const;

interface GameCard {
  title: string;
  description: string;
  route: string;
  Icon: React.ElementType;
}

const GAMES: GameCard[] = [
  {
    title:       "Dijkstra's Adventure",
    description: "Find the shortest path step by step",
    route:       "/game/dijkstra",
    Icon:        Route,
  },
  {
    title:       "BST Builder",
    description: "Build a binary search tree by placing numbers",
    route:       "/game/bst",
    Icon:        GitBranch,
  },
  {
    title:       "Floyd-Warshall Grid",
    description: "Fill the all-pairs shortest path matrix",
    route:       "/game/floyd-warshall",
    Icon:        Grid3x3,
  },
  {
    title:       "Missing Operator",
    description: "Find the operator that makes it true",
    route:       "/game/missing-operator",
    Icon:        Calculator,
  },
  {
    title:       "Interesting Maths Questions",
    description: "Solve curated logic puzzles",
    route:       "/game/maths-questions",
    Icon:        Brain,
  },
];

interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
}

// TODO: fetch from /api/leaderboard?limit=3
const TOP_USERS: LeaderboardEntry[] = [
  { rank: 1, name: "Sarah K.",  score: 4820 },
  { rank: 2, name: "Marcus T.", score: 4610 },
  { rank: 3, name: "Priya M.",  score: 4405 },
];

// ─── Animation variants ───────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0  },
};

const staggerContainer = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-widest text-textMuted">
        {label}
      </span>
      <span className={`font-mono text-4xl font-bold ${color}`}>{value}</span>
    </Card>
  );
}

function GameCardItem({ title, description, route, Icon }: GameCard) {
  return (
    <motion.div variants={fadeUp}>
      <Link to={route} className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl">
        <motion.div
          className="group h-full bg-panel border border-panelBorder rounded-xl p-5 flex flex-col gap-4 shadow-panel cursor-pointer"
          whileHover={{ y: -4, borderColor: "#FFD36E" }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
          style={{ borderColor: "#2A3166" }} // matches panelBorder; overridden on hover
        >
          {/* Icon container */}
          <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center border border-panelBorder group-hover:border-gold/50 transition-colors duration-300">
            <Icon
              size={20}
              className="text-node group-hover:text-gold transition-colors duration-300"
              aria-hidden="true"
            />
          </div>

          {/* Text */}
          <div className="flex flex-col gap-1">
            <h3 className="font-sans text-sm font-semibold text-textPrimary leading-snug">
              {title}
            </h3>
            <p className="font-sans text-xs text-textMuted leading-relaxed">
              {description}
            </p>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}

const rankIcons: Record<number, React.ReactNode> = {
  1: <Trophy size={14} className="text-gold" aria-hidden="true" />,
  2: <Medal  size={14} className="text-star" aria-hidden="true" />,
  3: <Medal  size={14} className="text-textMuted" aria-hidden="true" />,
};

// ─── Dashboard page ───────────────────────────────────────────────────────────

export default function Dashboard() {
  return (
    <div className="flex flex-col gap-10">

      {/* 1 ── Welcome header ─────────────────────────────────────────────── */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex flex-col gap-1"
      >
        <h1 className="font-sans text-3xl font-bold text-textPrimary">
          Welcome back,{" "}
          <span className="text-gold">{USERNAME}</span>
        </h1>
        <p className="font-sans text-sm text-textMuted">
          Ready for today's challenge?
        </p>
      </motion.div>

      {/* 2 ── Stats row ───────────────────────────────────────────────────── */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        {STATS.map((s) => (
          <motion.div key={s.label} variants={fadeUp}>
            <StatCard {...s} />
          </motion.div>
        ))}
      </motion.div>

      {/* 3 ── Game cards ──────────────────────────────────────────────────── */}
      <section aria-labelledby="journey-heading">
        <motion.h2
          id="journey-heading"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.35, delay: 0.15 }}
          className="mb-4 font-sans text-lg font-semibold text-textPrimary"
        >
          Continue your journey
        </motion.h2>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {GAMES.map((game) => (
            <GameCardItem key={game.route} {...game} />
          ))}
        </motion.div>
      </section>

      {/* 4 ── Leaderboard preview ─────────────────────────────────────────── */}
      <motion.section
        aria-labelledby="leaderboard-heading"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.35, delay: 0.35 }}
      >
        <Card className="max-w-sm">
          <h2
            id="leaderboard-heading"
            className="mb-4 font-sans text-sm font-semibold uppercase tracking-widest text-textMuted"
          >
            Top Players
          </h2>

          <ol className="flex flex-col gap-3" aria-label="Top 3 leaderboard">
            {TOP_USERS.map((user) => (
              <li
                key={user.rank}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  {/* Rank icon */}
                  <span className="w-5 flex justify-center">
                    {rankIcons[user.rank]}
                  </span>
                  {/* Avatar */}
                  <div className="h-7 w-7 rounded-full border border-panelBorder bg-background flex items-center justify-center text-[10px] font-bold text-node">
                    {user.name[0]}
                  </div>
                  <span className="font-sans text-sm text-textPrimary">
                    {user.name}
                  </span>
                </div>
                <span className="font-mono text-sm font-semibold text-gold">
                  {user.score.toLocaleString()}
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-5 pt-4 border-t border-panelBorder">
            <Link
              to="/leaderboard"
              className="font-sans text-sm font-medium text-gold hover:brightness-125 transition-all duration-200 focus-visible:outline-none focus-visible:underline"
            >
              View full leaderboard →
            </Link>
          </div>
        </Card>
      </motion.section>

    </div>
  );
}
