import { Flame, Sparkles } from "lucide-react";
import { NavLink } from "react-router-dom";

const navLinks = [
  { label: "Dashboard", to: "/" },
  { label: "Leaderboard", to: "/leaderboard" },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-panelBorder bg-panel/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">

        {/* ── Logo ─────────────────────────────────────────────────── */}
        <NavLink
          to="/"
          className="flex items-center gap-2 shrink-0 group"
          aria-label="AlgoMind home"
        >
          <Sparkles
            size={20}
            className="text-gold drop-shadow-[0_0_6px_#FFD36E] group-hover:animate-twinkle"
            aria-hidden="true"
          />
          <span className="font-sans text-xl font-bold tracking-tight text-gold drop-shadow-[0_0_8px_#FFD36E99]">
            AlgoMind
          </span>
        </NavLink>

        {/* ── Nav links (center / left-of-right) ───────────────────── */}
        <nav className="flex items-center gap-1 ml-6" aria-label="Main navigation">
          {navLinks.map(({ label, to }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                [
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200",
                  isActive
                    ? "text-gold bg-gold/10"
                    : "text-textMuted hover:text-textPrimary hover:bg-panelBorder/30",
                ].join(" ")
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* ── Right-side controls ───────────────────────────────────── */}
        <div className="ml-auto flex items-center gap-3">
          {/* Streak badge */}
          <div
            className="flex items-center gap-1.5 rounded-full border border-panelBorder bg-panel px-3 py-1.5"
            title="Current streak"
            aria-label="7 day streak"
          >
            <Flame size={15} className="text-gold" aria-hidden="true" />
            <span className="font-sans text-xs font-semibold text-textPrimary whitespace-nowrap">
              7 day streak
            </span>
          </div>

          {/* User avatar placeholder */}
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-node bg-panel text-xs font-bold text-node shadow-glow-node"
            aria-label="User avatar"
            role="img"
          >
            U
          </div>
        </div>

      </div>
    </header>
  );
}
