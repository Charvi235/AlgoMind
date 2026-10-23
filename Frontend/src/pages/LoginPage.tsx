/**
 * LoginPage.tsx
 *
 * Route: /login
 * Own layout — StarfieldBackground + centered card, no Navbar.
 *
 * Wired to POST /api/auth/login via AuthContext.login().
 * Accepts email or username in the identifier field.
 * On success navigates to /dashboard.
 * If a user is already authenticated, redirects to /dashboard immediately.
 */

import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Sparkles } from "lucide-react";
import StarfieldBackground from "../components/StarfieldBackground";
import Button from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";

// ─── Google "G" SVG ──────────────────────────────────────────────────────────

function GoogleG() {
  return (
    <svg
      width="18" height="18"
      viewBox="0 0 18 18"
      aria-hidden="true"
      focusable="false"
    >
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.185l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  );
}

// ─── Divider ─────────────────────────────────────────────────────────────────

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3" role="separator" aria-label={label}>
      <div className="flex-1 h-px bg-panelBorder" />
      <span className="text-xs text-textMuted select-none">{label}</span>
      <div className="flex-1 h-px bg-panelBorder" />
    </div>
  );
}

// ─── Themed input ─────────────────────────────────────────────────────────────

interface ThemedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label:         string;
  id:            string;
  errorMessage?: string;
  rightSlot?:    React.ReactNode;
}

function ThemedInput({ label, id, errorMessage, rightSlot, className = "", ...rest }: ThemedInputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-textPrimary select-none">
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          className={[
            "w-full rounded-lg px-4 py-2.5 text-sm text-textPrimary",
            "bg-panel border border-panelBorder",
            "placeholder:text-textMuted",
            "outline-none transition-shadow duration-200",
            "focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-background",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            rightSlot ? "pr-11" : "",
            errorMessage ? "border-error focus:ring-error" : "",
            className,
          ].filter(Boolean).join(" ")}
          aria-describedby={errorMessage ? `${id}-error` : undefined}
          aria-invalid={!!errorMessage}
          {...rest}
        />
        {rightSlot && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            {rightSlot}
          </div>
        )}
      </div>

      {/* Error area — always present in DOM so layout doesn't shift */}
      <p
        id={`${id}-error`}
        role="alert"
        aria-live="polite"
        className="min-h-[1rem] text-xs text-error"
      >
        {errorMessage ?? ""}
      </p>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate        = useNavigate();

  const [identifier,   setIdentifier]   = useState("");
  const [password,     setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [serverError,  setServerError]  = useState("");

  // Already logged in — redirect without blocking the render.
  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setServerError("");
    setLoading(true);

    try {
      await login(identifier, password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setServerError(
        err instanceof Error
          ? err.message
          : "Login failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <StarfieldBackground />

      <div className="relative z-0 flex min-h-screen flex-col items-center justify-center px-4 py-12">

        {/* Card */}
        <motion.div
          className="w-full max-w-sm"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center justify-center gap-2 mb-8 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded"
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

          <div className="rounded-2xl border border-panelBorder bg-panel p-8 shadow-panel flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h1 className="font-sans text-xl font-bold text-textPrimary">
                Welcome back
              </h1>
              <p className="text-sm text-textMuted">
                Log in to continue your algorithm journey.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
              {/* Server-level error */}
              {serverError && (
                <p
                  role="alert"
                  aria-live="assertive"
                  className="rounded-lg border border-error/40 bg-error/10 px-4 py-2.5 text-sm text-error"
                >
                  {serverError}
                </p>
              )}

              <ThemedInput
                id="login-identifier"
                label="Email or username"
                type="text"
                autoComplete="username"
                placeholder="you@example.com or cool_coder42"
                value={identifier}
                onChange={(e) => { setIdentifier(e.target.value); setServerError(""); }}
                required
                disabled={loading}
              />

              <ThemedInput
                id="login-password"
                label="Password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setServerError(""); }}
                required
                disabled={loading}
                rightSlot={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="text-textMuted hover:text-textPrimary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-node rounded p-0.5 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    tabIndex={0}
                  >
                    {showPassword
                      ? <EyeOff size={16} aria-hidden="true" />
                      : <Eye    size={16} aria-hidden="true" />
                    }
                  </button>
                }
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-xs text-textMuted hover:text-textPrimary transition-colors focus-visible:outline-none focus-visible:underline rounded"
                  aria-label="Forgot password — not yet available"
                  onClick={() => {
                    // TODO: wire up password-reset flow
                  }}
                >
                  Forgot password?
                </button>
              </div>

              <Button
                type="submit"
                variant="primary"
                disabled={loading}
                className="w-full min-h-[44px] font-bold"
              >
                {loading ? "Logging in…" : "Log in"}
              </Button>
            </form>

            <Divider label="or" />

            {/* Google button */}
            <button
              type="button"
              disabled={loading}
              className={[
                "flex w-full min-h-[44px] items-center justify-center gap-3",
                "rounded-lg border border-panelBorder bg-transparent",
                "font-sans text-sm font-medium text-textPrimary",
                "hover:bg-panelBorder/20 transition-colors duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-node",
                "disabled:opacity-40 disabled:cursor-not-allowed",
              ].join(" ")}
              onClick={() => {
                // TODO: wire up Google OAuth flow
                console.log("[LoginPage] Google sign-in clicked");
              }}
            >
              <GoogleG />
              Continue with Google
            </button>

            <p className="text-center text-sm text-textMuted">
              Don&apos;t have an account?{" "}
              <Link
                to="/signup"
                className="font-medium text-node hover:brightness-125 transition-all underline underline-offset-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-node rounded"
              >
                Sign up
              </Link>
            </p>
          </div>
        </motion.div>

      </div>
    </>
  );
}
