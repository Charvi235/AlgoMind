import { motion } from "framer-motion";
import { Trophy, Medal, Award, TrendingUp, Flame } from "lucide-react";
import { Link } from "react-router-dom";
import Card from "../components/ui/Card";

// ─── Mock data ────────────────────────────────────────────────────────────────
// TODO: replace with GET /api/leaderboard?limit=20
// Response shape: { rank: number, name: string, score: number, streak: number, accuracy: number }[]

interface LeaderboardUser {
  rank:     number;
  name:     string;
  score:    number;
  streak:   number;
  accuracy: number;
  isCurrentUser?: boolean;
}

const MOCK_USERS: LeaderboardUser[] = [
  { rank:  1, name: "Sarah K.",    score: 4820, streak: 14, accuracy: 97 },
  { rank:  2, name: "Marcus T.",   score: 4610, streak: 10, accuracy: 94 },
  { rank:  3, name: "Priya M.",    score: 4405, streak:  8, accuracy: 92 },
  { rank:  4, name: "Lena W.",     score: 4200, streak:  6, accuracy: 91 },
  { rank:  5, name: "Kai R.",      score: 4050, streak:  5, accuracy: 89 },
  { rank:  6, name: "Omar S.",     score: 3980, streak:  7, accuracy: 88 },
  { rank:  7, name: "Yuki N.",     score: 3810, streak:  4, accuracy: 87 },
  { rank:  8, name: "Fatima A.",   score: 3760, streak:  3, accuracy: 86 },
  { rank:  9, name: "Devlin C.",   score: 3680, streak:  9, accuracy: 85 },
  { rank: 10, name: "Hana B.",     score: 3550, streak:  2, accuracy: 84 },
  { rank: 11, name: "Tariq J.",    score: 3440, streak:  1, accuracy: 83 },
  { rank: 12, name: "Elena P.",    score: 3300, streak:  5, accuracy: 82 },
  { rank: 13, name: "Rohan D.",    score: 3210, streak:  3, accuracy: 81 },
  { rank: 14, name: "Alex",        score: 3100, streak:  7, accuracy: 92, isCurrentUser: true },
  { rank: 15, name: "Mei L.",      score: 2990, streak:  2, accuracy: 79 },
];

// ─── Rank badge ───────────────────────────────────────────────────────────────
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Trophy   size={16} className="text-gold"     aria-label="1st place" />;
  if (rank === 2) return <Medal    size={16} className="text-star"     aria-label="2nd place" />;
  if (rank === 3) return <Award    size={16} className="text-textMuted" aria-label="3rd place" />;
  return (
    <span className="font-mono text-xs font-bold text-textMuted w-4 text-center">
      {rank}
    </span>
  );
}

// ─── Animation variants ───────────────────────────────────────────────────────
const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } };
const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.04, delayChildren: 0.1 } },
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function Leaderboard() {
  const top3 = MOCK_USERS.slice(0, 3);
  const rest = MOCK_USERS.slice(3);

  return (
    <motion.div
      className="flex flex-col gap-8"
      variants={stagger}
      initial="hidden"
      animate="visible"
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <motion.div variants={fadeUp}>
        <h1 className="font-sans text-2xl font-bold text-textPrimary">Leaderboard</h1>
        <p className="mt-1 text-sm text-textMuted">
          Top players across all algorithm challenges.
        </p>
      </motion.div>

      {/* ── Top 3 podium ────────────────────────────────────────────────── */}
      <motion.div
        variants={fadeUp}
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        aria-label="Top 3 players"
      >
        {top3.map((user) => {
              const isGold   = user.rank === 1;
              const isSilver = user.rank === 2;
              return (
                <Card
                  key={user.rank}
                  className={`flex flex-col gap-3 ${isGold ? "!border-gold/60" : isSilver ? "!border-star/40" : ""}`}
                  style={isGold
                    ? { boxShadow: "0 0 0 1px rgba(255,211,110,0.2), 0 0 20px 4px rgba(255,211,110,0.08)" }
                    : undefined
                  }
                >
                  <div className="flex items-center justify-between">
                    <RankBadge rank={user.rank} />
                    <span className="font-mono text-xs text-textMuted">
                      <Flame size={11} className="inline mr-1 text-gold" aria-hidden="true" />
                      {user.streak}d
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-full border-2 flex items-center justify-center font-bold text-sm shrink-0"
                      style={{
                        borderColor: isGold ? "#FFD36E" : isSilver ? "#8A93B8" : "#9199B5",
                        color:       isGold ? "#FFD36E" : isSilver ? "#8A93B8" : "#9199B5",
                        background:  "#060709",
                      }}
                      aria-label={`${user.name}'s avatar`}
                    >
                      {user.name[0]}
                    </div>
                    <div>
                      <p className="font-sans text-sm font-semibold text-textPrimary">{user.name}</p>
                      <p className="font-mono text-xs text-textMuted">{user.accuracy}% accuracy</p>
                    </div>
                  </div>
                  <p className="font-mono text-2xl font-bold text-gold">
                    {user.score.toLocaleString()}
                    <span className="text-xs text-textMuted font-normal ml-1">pts</span>
                  </p>
                </Card>
              );
            })}
      </motion.div>

      {/* ── Full table ──────────────────────────────────────────────────── */}
      <motion.div variants={fadeUp}>
        <Card className="!p-0 overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[2.5rem_1fr_auto_auto_auto] gap-x-4 items-center px-5 py-3 border-b border-panelBorder">
            <span className="text-xs uppercase tracking-widest text-textMuted">#</span>
            <span className="text-xs uppercase tracking-widest text-textMuted">Player</span>
            <span className="text-xs uppercase tracking-widest text-textMuted hidden sm:block">Streak</span>
            <span className="text-xs uppercase tracking-widest text-textMuted hidden sm:block">Accuracy</span>
            <span className="text-xs uppercase tracking-widest text-textMuted text-right">Score</span>
          </div>

          {/* Rows */}
          <motion.ul
            role="list"
            aria-label="Full leaderboard"
            variants={stagger}
            initial="hidden"
            animate="visible"
          >
            {rest.map((user) => (
                  <motion.li
                    key={user.rank}
                    variants={fadeUp}
                    className={[
                      "grid grid-cols-[2.5rem_1fr_auto_auto_auto] gap-x-4 items-center px-5 py-3 border-b border-panelBorder/50 last:border-0 transition-colors duration-150",
                      user.isCurrentUser
                        ? "bg-node/5 border-l-2 border-l-node"
                        : "hover:bg-panelBorder/20",
                    ].join(" ")}
                    aria-label={`${user.isCurrentUser ? "You: " : ""}Rank ${user.rank}: ${user.name}, ${user.score} points`}
                  >
                    {/* Rank */}
                    <div className="flex justify-center">
                      <RankBadge rank={user.rank} />
                    </div>

                    {/* Player */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="h-8 w-8 rounded-full border flex items-center justify-center font-bold text-xs shrink-0"
                        style={{
                          borderColor: user.isCurrentUser ? "#7FA8FF" : "#2A3166",
                          color:       user.isCurrentUser ? "#7FA8FF" : "#9199B5",
                          background:  "#060709",
                        }}
                        aria-hidden="true"
                      >
                        {user.name[0]}
                      </div>
                      <span className={`font-sans text-sm truncate ${
                        user.isCurrentUser ? "font-bold text-node" : "text-textPrimary"
                      }`}>
                        {user.name}{user.isCurrentUser && " (you)"}
                      </span>
                    </div>

                    {/* Streak */}
                    <div className="hidden sm:flex items-center gap-1 text-xs text-textMuted font-mono">
                      <Flame size={11} className="text-gold shrink-0" aria-hidden="true" />
                      {user.streak}d
                    </div>

                    {/* Accuracy */}
                    <div className="hidden sm:flex items-center gap-1 text-xs font-mono">
                      <TrendingUp size={11} className="text-teal shrink-0" aria-hidden="true" />
                      <span className="text-teal">{user.accuracy}%</span>
                    </div>

                    {/* Score */}
                    <span className="font-mono text-sm font-bold text-gold text-right tabular-nums">
                      {user.score.toLocaleString()}
                    </span>
                  </motion.li>
                ))}
          </motion.ul>
        </Card>
      </motion.div>

      {/* ── Back link ───────────────────────────────────────────────────── */}
      <motion.div variants={fadeUp}>
        <Link
          to="/"
          className="text-sm text-textMuted hover:text-textPrimary transition-colors focus-visible:outline-none focus-visible:underline"
        >
          ← Back to Dashboard
        </Link>
      </motion.div>
    </motion.div>
  );
}
