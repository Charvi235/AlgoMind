import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Trophy, Medal, Award, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import Card from "../components/ui/Card";
import { apiAuthGet, ApiError } from "../lib/api";

// ─── API response types ───────────────────────────────────────────────────────

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

// ─── Rank badge ───────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Trophy size={16} className="text-gold"      aria-label="1st place" />;
  if (rank === 2) return <Medal  size={16} className="text-star"      aria-label="2nd place" />;
  if (rank === 3) return <Award  size={16} className="text-textMuted" aria-label="3rd place" />;
  return (
    <span className="font-mono text-xs font-bold text-textMuted w-4 text-center">
      {rank}
    </span>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block rounded bg-panelBorder/40 animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}

// ─── Animation variants ───────────────────────────────────────────────────────

const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } };
const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.04, delayChildren: 0.1 } },
};

// ─── Row component ────────────────────────────────────────────────────────────

function LeaderboardRow({
  entry,
  separator = true,
}: {
  entry:      LeaderboardEntry;
  separator?: boolean;
}) {
  return (
    <motion.li
      variants={fadeUp}
      className={[
        "grid grid-cols-[2.5rem_1fr_auto] gap-x-4 items-center px-5 py-3 transition-colors duration-150",
        separator ? "border-b border-panelBorder/50 last:border-0" : "",
        entry.isMe
          ? "bg-node/5 border-l-2 border-l-node"
          : "hover:bg-panelBorder/20",
      ].join(" ")}
      aria-label={`${entry.isMe ? "You: " : ""}Rank ${entry.rank}: ${entry.username}, ${entry.totalXP.toLocaleString()} XP`}
    >
      {/* Rank */}
      <div className="flex justify-center">
        <RankBadge rank={entry.rank} />
      </div>

      {/* Player */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="h-8 w-8 rounded-full border flex items-center justify-center font-bold text-xs shrink-0"
          style={{
            borderColor: entry.isMe ? "#7FA8FF" : "#2A3166",
            color:       entry.isMe ? "#7FA8FF" : "#9199B5",
            background:  "#060709",
          }}
          aria-hidden="true"
        >
          {entry.username[0]?.toUpperCase()}
        </div>
        <span
          className={`font-sans text-sm truncate ${
            entry.isMe ? "font-bold text-node" : "text-textPrimary"
          }`}
        >
          {entry.username}{entry.isMe ? " (you)" : ""}
        </span>
      </div>

      {/* XP */}
      <span className="font-mono text-sm font-bold text-gold text-right tabular-nums">
        {entry.totalXP.toLocaleString()}
      </span>
    </motion.li>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Leaderboard() {
  const [data,    setData]    = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiAuthGet<LeaderboardData>("/api/leaderboard?limit=50");
      setData(result);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return; // redirect triggered
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't load the leaderboard. Check your connection.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Whether the current user appears anywhere in the entries list.
  const meInList = data?.entries.some((e) => e.isMe) ?? false;

  // Separate "me" row shown at the bottom only when me is outside the top-50.
  const meOutsideList: LeaderboardEntry | null =
    data?.me && !meInList && data.me.rank !== null
      ? { rank: data.me.rank, username: data.me.username, totalXP: data.me.totalXP, isMe: true }
      : null;

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

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && (
        <motion.div
          variants={fadeUp}
          role="alert"
          className="flex items-center gap-4 rounded-xl border border-error/40 bg-error/10 px-5 py-3"
        >
          <p className="flex-1 text-sm text-error">{error}</p>
          <button
            onClick={() => void load()}
            className="flex items-center gap-1.5 text-xs font-medium text-error hover:brightness-125 transition-all focus-visible:outline-none focus-visible:underline"
            aria-label="Retry loading leaderboard"
          >
            <RefreshCw size={13} aria-hidden="true" />
            Retry
          </button>
        </motion.div>
      )}

      {/* ── Top 3 podium ────────────────────────────────────────────────── */}
      {(loading || (data?.entries && data.entries.length > 0)) && (
        <motion.div
          variants={fadeUp}
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
          aria-label="Top 3 players"
        >
          {loading
            ? [1, 2, 3].map((i) => (
                <Card key={i} className="flex flex-col gap-3">
                  <Skeleton className="w-8 h-4" />
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex flex-col gap-1.5">
                      <Skeleton className="w-24 h-4" />
                      <Skeleton className="w-16 h-3" />
                    </div>
                  </div>
                  <Skeleton className="w-20 h-8" />
                </Card>
              ))
            : data!.entries.slice(0, 3).map((entry) => {
                const isGold   = entry.rank === 1;
                const isSilver = entry.rank === 2;
                return (
                  <Card
                    key={entry.rank}
                    className={`flex flex-col gap-3 ${isGold ? "!border-gold/60" : isSilver ? "!border-star/40" : ""}`}
                    style={
                      isGold
                        ? { boxShadow: "0 0 0 1px rgba(255,211,110,0.2), 0 0 20px 4px rgba(255,211,110,0.08)" }
                        : undefined
                    }
                  >
                    <div className="flex items-center justify-between">
                      <RankBadge rank={entry.rank} />
                    </div>
                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-full border-2 flex items-center justify-center font-bold text-sm shrink-0"
                        style={{
                          borderColor: isGold ? "#FFD36E" : isSilver ? "#8A93B8" : "#9199B5",
                          color:       isGold ? "#FFD36E" : isSilver ? "#8A93B8" : "#9199B5",
                          background:  "#060709",
                        }}
                        aria-label={`${entry.username}'s avatar`}
                      >
                        {entry.username[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className={`font-sans text-sm font-semibold ${entry.isMe ? "text-node" : "text-textPrimary"}`}>
                          {entry.username}{entry.isMe ? " (you)" : ""}
                        </p>
                      </div>
                    </div>
                    <p className="font-mono text-2xl font-bold text-gold">
                      {entry.totalXP.toLocaleString()}
                      <span className="text-xs text-textMuted font-normal ml-1">XP</span>
                    </p>
                  </Card>
                );
              })
          }
        </motion.div>
      )}

      {/* ── Full table ──────────────────────────────────────────────────── */}
      <motion.div variants={fadeUp}>
        <Card className="!p-0 overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[2.5rem_1fr_auto] gap-x-4 items-center px-5 py-3 border-b border-panelBorder">
            <span className="text-xs uppercase tracking-widest text-textMuted">#</span>
            <span className="text-xs uppercase tracking-widest text-textMuted">Player</span>
            <span className="text-xs uppercase tracking-widest text-textMuted text-right">XP</span>
          </div>

          {/* Loading skeleton rows */}
          {loading && (
            <ul aria-busy="true" aria-label="Loading leaderboard">
              {Array.from({ length: 8 }, (_, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[2.5rem_1fr_auto] gap-x-4 items-center px-5 py-3 border-b border-panelBorder/50 last:border-0"
                >
                  <Skeleton className="w-4 h-4 mx-auto" />
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <Skeleton className="w-28 h-4" />
                  </div>
                  <Skeleton className="w-14 h-4 ml-auto" />
                </li>
              ))}
            </ul>
          )}

          {/* Empty state */}
          {!loading && !error && data?.entries.length === 0 && (
            <p className="px-5 py-8 text-sm text-center text-textMuted">
              No scores yet. Be the first!
            </p>
          )}

          {/* Populated rows */}
          {!loading && data && data.entries.length > 0 && (
            <motion.ul
              role="list"
              aria-label="Full leaderboard"
              variants={stagger}
              initial="hidden"
              animate="visible"
            >
              {data.entries.map((entry) => (
                <LeaderboardRow key={`${entry.rank}-${entry.username}`} entry={entry} />
              ))}
            </motion.ul>
          )}

          {/* "Your rank" row — only when me is outside the visible list */}
          {!loading && meOutsideList && (
            <>
              <div className="px-5 py-2 border-t border-panelBorder/50">
                <span className="text-xs text-textMuted uppercase tracking-widest">
                  Your rank
                </span>
              </div>
              <motion.ul
                role="list"
                aria-label="Your rank"
                variants={stagger}
                initial="hidden"
                animate="visible"
              >
                <LeaderboardRow entry={meOutsideList} separator={false} />
              </motion.ul>
            </>
          )}
        </Card>
      </motion.div>

      {/* ── Back link ───────────────────────────────────────────────────── */}
      <motion.div variants={fadeUp}>
        <Link
          to="/dashboard"
          className="text-sm text-textMuted hover:text-textPrimary transition-colors focus-visible:outline-none focus-visible:underline"
        >
          ← Back to Dashboard
        </Link>
      </motion.div>
    </motion.div>
  );
}
