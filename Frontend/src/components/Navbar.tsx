import { Flame, Sparkles, LogOut } from "lucide-react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const navLinks = [
  { label: "Dashboard",   to: "/dashboard"   },
  { label: "Leaderboard", to: "/leaderboard" },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-panelBorder bg-panel/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">

        {/* ── Logo ─────────────────────────────────────────────────── */}
        <NavLink
          to="/dashboard"
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

        {/* ── Nav links ────────────────────────────────────────────── */}
        <nav className="flex items-center gap-1 ml-6" aria-label="Main navigation">
          {navLinks.map(({ label, to }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/dashboard"}
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
          {user ? (
            <>
              {/* Streak badge — uses live data from the user object */}
              <div
                className="flex items-center gap-1.5 rounded-full border border-panelBorder bg-panel px-3 py-1.5"
                title="Current streak"
                aria-label={`${user.current_streak} day streak`}
              >
                <Flame size={15} className="text-gold" aria-hidden="true" />
                <span className="font-sans text-xs font-semibold text-textPrimary whitespace-nowrap">
                  {user.current_streak} day streak
                </span>
              </div>

              {/* User avatar + username */}
              <div className="flex items-center gap-2">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-node bg-panel text-xs font-bold text-node shadow-glow-node select-none"
                  aria-hidden="true"
                >
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:block font-sans text-sm font-medium text-textPrimary">
                  {user.username}
                </span>
              </div>

              {/* Log out button */}
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-textMuted hover:text-error hover:bg-error/10 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error min-h-[36px]"
                aria-label="Log out"
              >
                <LogOut size={15} aria-hidden="true" />
                <span className="hidden sm:inline">Log out</span>
              </button>
            </>
          ) : (
            /* Unauthenticated — show a Log in link */
            <Link
              to="/login"
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-textMuted hover:text-textPrimary hover:bg-panelBorder/30 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-node min-h-[36px] flex items-center"
            >
              Log in
            </Link>
          )}
        </div>

      </div>
    </header>
  );
}
