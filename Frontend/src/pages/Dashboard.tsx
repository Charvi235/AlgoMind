import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Trophy, Medal, Box, RefreshCw } from "lucide-react";
import Card from "../components/ui/Card";
import { gameRegistryList, type GameRegistryEntry } from "../config/gameRegistry";
import { gameIconMap } from "../config/gameIconMap";
import { apiAuthGet, ApiError } from "../lib/api";

// ─── API response types ───────────────────────────────────────────────────────

interface DashboardData {
  username:       string;
  totalXP:        number;
  rank:           number | null;
  xpToday:        number;
  gamesPlayed:    number;
  accuracy:       number | null;
  current_streak: number;
  longest_streak: number;
}

interface LeaderboardEntry {
  rank:     number;
  username: string;
  totalXP:  number;
  isMe:     boolean;
}

interface LeaderboardData {
  entries: LeaderboardEntry[];
  me:      { rank: number | null; username: string; totalXP: number } | null;
}

// ─── Animation variants ───────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0  },
};

const staggerContainer = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

// ─── Game card data (static, registry-driven) ─────────────────────────────────

interface GameCard {
  title:       string;
  description: string;
  route:       string;
  Icon:        React.ElementType;
}

const GAMES: GameCard[] = gameRegistryList.map((entry: GameRegistryEntry) => ({
  title:       entry.title,
  description: entry.description,
  route:       `/game/${entry.routeKey}`,
  Icon:        gameIconMap[entry.iconName] ?? Box,
}));

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
      <Link
        to={route}
        className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl"
      >
        <motion.div
          className="group h-full bg-panel border border-panelBorder rounded-xl p-5 flex flex-col gap-4 shadow-panel cursor-pointer"
          whileHover={{ y: -4, borderColor: "#FFD36E" }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
          style={{ borderColor: "#2A3166" }}
        >
          <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center border border-panelBorder group-hover:border-gold/50 transition-colors duration-300">
            <Icon
              size={20}
              className="text-node group-hover:text-gold transition-colors duration-300"
              aria-hidden="true"
            />
          </div>
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
  1: <Trophy size={14} className="text-gold"     aria-hidden="true" />,
  2: <Medal  size={14} className="text-star"     aria-hidden="true" />,
  3: <Medal  size={14} className="text-textMuted" aria-hidden="true" />,
};

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block rounded bg-panelBorder/40 animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}

// ─── Dashboard page ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [dash,      setDash]      = useState<DashboardData | null>(null);
  const [top3,      setTop3]      = useState<LeaderboardEntry[] | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashData, lbData] = await Promise.all([
        apiAuthGet<DashboardData>("/api/me/dashboard"),
        apiAuthGet<LeaderboardData>("/api/leaderboard?limit=3"),
      ]);
      setDash(dashData);
      setTop3(lbData.entries.slice(0, 3));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return; // redirect already triggered
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't load your dashboard. Check your connection.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // ── Derived display values ────────────────────────────────────────────────
  const rankDisplay     = dash?.rank     != null ? `#${dash.rank}`        : "—";
  const accuracyDisplay = dash?.accuracy != null ? `${dash.accuracy}%`    : "—";
  const xpTodayDisplay  = dash           != null ? `+${dash.xpToday}`     : "+0";

  const stats = [
    { label: "Rank",     value: rankDisplay,     color: "text-textPrimary" },
    { label: "Accuracy", value: accuracyDisplay, color: "text-teal"        },
    { label: "XP Today", value: xpTodayDisplay,  color: "text-gold"        },
  ] as const;

  return (
    <div className="flex flex-col gap-10">

      {/* 1 ── Welcome header ──────────────────────────────────────────────── */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex flex-col gap-1"
      >
        <h1 className="font-sans text-3xl font-bold text-textPrimary">
          Welcome back,{" "}
          {loading
            ? <Skeleton className="w-28 h-8 align-middle" />
            : <span className="text-gold">{dash?.username ?? "—"}</span>
          }
        </h1>
        <p className="font-sans text-sm text-textMuted">
          Ready for today's challenge?
        </p>
      </motion.div>

      {/* ── Inline error ──────────────────────────────────────────────────── */}
      {error && (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          role="alert"
          className="flex items-center gap-4 rounded-xl border border-error/40 bg-error/10 px-5 py-3"
        >
          <p className="flex-1 text-sm text-error">{error}</p>
          <button
            onClick={() => void load()}
            className="flex items-center gap-1.5 text-xs font-medium text-error hover:brightness-125 transition-all focus-visible:outline-none focus-visible:underline"
            aria-label="Retry loading dashboard"
          >
            <RefreshCw size={13} aria-hidden="true" />
            Retry
          </button>
        </motion.div>
      )}

      {/* 2 ── Stats row ───────────────────────────────────────────────────── */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        {stats.map((s) => (
          <motion.div key={s.label} variants={fadeUp}>
            {loading
              ? (
                <Card className="flex flex-col gap-1">
                  <Skeleton className="w-16 h-3" />
                  <Skeleton className="w-20 h-10" />
                </Card>
              )
              : <StatCard {...s} />
            }
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

          {loading ? (
            <ul className="flex flex-col gap-3" aria-busy="true" aria-label="Loading leaderboard">
              {[1, 2, 3].map((i) => (
                <li key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-5 h-4" />
                    <Skeleton className="w-7 h-7 rounded-full" />
                    <Skeleton className="w-24 h-4" />
                  </div>
                  <Skeleton className="w-12 h-4" />
                </li>
              ))}
            </ul>
          ) : top3 && top3.length > 0 ? (
            <ol className="flex flex-col gap-3" aria-label="Top 3 leaderboard">
              {top3.map((entry) => (
                <li key={entry.rank} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-5 flex justify-center">
                      {rankIcons[entry.rank] ?? (
                        <span className="font-mono text-xs font-bold text-textMuted">
                          {entry.rank}
                        </span>
                      )}
                    </span>
                    <div
                      className="h-7 w-7 rounded-full border border-panelBorder bg-background flex items-center justify-center text-[10px] font-bold text-node"
                      aria-hidden="true"
                    >
                      {entry.username[0]?.toUpperCase()}
                    </div>
                    <span
                      className={`font-sans text-sm ${entry.isMe ? "font-bold text-node" : "text-textPrimary"}`}
                    >
                      {entry.username}{entry.isMe ? " (you)" : ""}
                    </span>
                  </div>
                  <span className="font-mono text-sm font-semibold text-gold">
                    {entry.totalXP.toLocaleString()}
                  </span>
                </li>
              ))}
            </ol>
          ) : !error ? (
            <p className="text-sm text-textMuted">No scores yet. Be the first!</p>
          ) : null}

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
