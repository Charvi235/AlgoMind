/**
 * ForgotPasswordPage.tsx
 *
 * Route: /forgot-password  (public)
 *
 * Three-step flow:
 *   Step 1 "Reset your password" — email → POST /api/auth/password/forgot
 *   Step 2 "Check your email"    — 6-digit OTP → POST /api/auth/password/verify
 *   Step 3 "Create new password" — new password + confirm → POST /api/auth/password/reset
 *
 * On success: navigate to /login with router state { success: "..." }.
 * Email and resetToken are kept in component state only, never persisted.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Sparkles, Loader2 } from "lucide-react";
import StarfieldBackground from "../components/StarfieldBackground";
import Button from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import { apiPost, ApiError } from "../lib/api";

// ─── safeFrom helper (same as LoginPage / SignupPage) ────────────────────────

function safeFrom(state: unknown): string {
  if (
    state !== null &&
    typeof state === "object" &&
    "from" in state &&
    typeof (state as { from: unknown }).from === "string"
  ) {
    const from = (state as { from: string }).from;
    if (from.startsWith("/") && !from.startsWith("//")) return from;
  }
  return "/dashboard";
}

// ─── Step dots ────────────────────────────────────────────────────────────────

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2" aria-label={`Step ${current} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={[
            "rounded-full transition-all duration-300",
            i + 1 === current
              ? "w-5 h-2 bg-gold shadow-[0_0_6px_#FFD36E99]"
              : i + 1 < current
              ? "w-2 h-2 bg-gold/50"
              : "w-2 h-2 bg-panelBorder",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

// ─── Themed input ─────────────────────────────────────────────────────────────

interface ThemedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label:         string;
  id:            string;
  hint?:         string;
  errorMessage?: string;
  rightSlot?:    React.ReactNode;
}

function ThemedInput({
  label, id, hint, errorMessage, rightSlot, className = "", ...rest
}: ThemedInputProps) {
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
          aria-describedby={[
            hint         ? `${id}-hint`  : "",
            errorMessage ? `${id}-error` : "",
          ].filter(Boolean).join(" ") || undefined}
          aria-invalid={!!errorMessage}
          {...rest}
        />
        {rightSlot && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            {rightSlot}
          </div>
        )}
      </div>
      {hint && <p id={`${id}-hint`} className="text-xs text-textMuted">{hint}</p>}
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

// ─── Error banner ─────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      aria-live="assertive"
      className="rounded-lg border border-error/40 bg-error/10 px-4 py-2.5 text-sm text-error"
    >
      {message}
    </p>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ForgotPasswordPage() {
  const { user }    = useAuth();
  const navigate    = useNavigate();
  const location    = useLocation();
  const destination = safeFrom(location.state);

  // Redirect already-logged-in users.
  useEffect(() => {
    if (user) navigate(destination, { replace: true });
  }, [user, navigate, destination]);

  // ── Shared state ─────────────────────────────────────────────────────────
  const [step,    setStep]    = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  // Step 1
  const [email, setEmail] = useState("");

  // Step 2
  const [code,           setCode]           = useState("");
  const [resendCooldown, setResendCooldown]  = useState(0);
  const [resetToken,     setResetToken]      = useState(""); // kept in state only
  const resendTimerRef                       = useRef<ReturnType<typeof setInterval> | null>(null);

  // Step 3
  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew,         setShowNew]         = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [confirmError,    setConfirmError]    = useState("");

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => () => {
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
  }, []);

  // ── Countdown helper ─────────────────────────────────────────────────────
  const startResendCooldown = useCallback((seconds: number) => {
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    setResendCooldown(seconds);
    resendTimerRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(resendTimerRef.current!);
          resendTimerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ── Step 1: send code ────────────────────────────────────────────────────
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const data = await apiPost<{ ok: boolean; resendAfterSeconds: number }>(
        "/api/auth/password/forgot",
        { email },
      );
      startResendCooldown(data.resendAfterSeconds);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: verify OTP ───────────────────────────────────────────────────
  const submitCode = useCallback(async (codeValue: string) => {
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const data = await apiPost<{ ok: boolean; resetToken: string }>(
        "/api/auth/password/verify",
        { email, code: codeValue },
      );
      setResetToken(data.resetToken);
      setStep(3);
    } catch (err) {
      if (err instanceof ApiError) {
        const extra = err.attemptsLeft != null
          ? ` (${err.attemptsLeft} attempt${err.attemptsLeft === 1 ? "" : "s"} left)`
          : "";
        setError(err.message + extra);
      } else {
        setError(err instanceof Error ? err.message : "Verification failed.");
      }
    } finally {
      setLoading(false);
    }
  }, [loading, email]);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
    setCode(val);
    setError("");
    if (val.length === 6) submitCode(val);
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || loading) return;
    setError("");
    setLoading(true);
    try {
      const data = await apiPost<{ ok: boolean; resendAfterSeconds: number }>(
        "/api/auth/password/forgot",
        { email },
      );
      startResendCooldown(data.resendAfterSeconds);
      setCode("");
    } catch (err) {
      if (err instanceof ApiError && err.retryAfterSeconds != null) {
        startResendCooldown(err.retryAfterSeconds);
      }
      setError(err instanceof Error ? err.message : "Could not resend code.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: set new password ──────────────────────────────────────────────
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (newPassword !== confirmPassword) {
      setConfirmError("Passwords do not match.");
      return;
    }
    setConfirmError("");
    setError("");
    setLoading(true);
    try {
      await apiPost("/api/auth/password/reset", { email, resetToken, newPassword });
      navigate("/login", {
        replace: true,
        state: { success: "Password updated. You can now log in with your new password." },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <StarfieldBackground />

      <div className="relative z-0 flex min-h-screen flex-col items-center justify-center px-4 py-12">
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
            <StepDots current={step} total={3} />

            <AnimatePresence mode="wait" initial={false}>

              {/* ── Step 1 ──────────────────────────────────────────────── */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col gap-6"
                >
                  <div className="flex flex-col gap-1">
                    <h1 className="font-sans text-xl font-bold text-textPrimary">
                      Reset your password
                    </h1>
                    <p className="text-sm text-textMuted">
                      Enter the email address on your account. If it exists we'll send a code.
                    </p>
                  </div>

                  <form onSubmit={handleForgot} noValidate className="flex flex-col gap-5">
                    <ErrorBanner message={error} />

                    <ThemedInput
                      id="fp-email"
                      label="Email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(""); }}
                      required
                      disabled={loading}
                    />

                    <Button type="submit" variant="primary" disabled={loading} className="w-full min-h-[44px] font-bold">
                      {loading
                        ? <span className="flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin" aria-hidden="true" />Sending code…</span>
                        : "Send code"
                      }
                    </Button>
                  </form>

                  <p className="text-center text-sm text-textMuted">
                    <Link
                      to="/login"
                      className="font-medium text-node hover:brightness-125 transition-all underline underline-offset-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-node rounded"
                    >
                      ← Back to log in
                    </Link>
                  </p>
                </motion.div>
              )}

              {/* ── Step 2 ──────────────────────────────────────────────── */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col gap-6"
                >
                  <div className="flex flex-col gap-1">
                    <h1 className="font-sans text-xl font-bold text-textPrimary">
                      Check your email
                    </h1>
                    <p className="text-sm text-textMuted">
                      We sent a 6-digit code to{" "}
                      <span className="font-medium text-textPrimary">{email}</span>.
                    </p>
                  </div>

                  <div className="flex flex-col gap-5">
                    <ErrorBanner message={error} />

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="fp-otp" className="text-sm font-medium text-textPrimary select-none">
                        Reset code
                      </label>
                      <input
                        id="fp-otp"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="\d{6}"
                        maxLength={6}
                        placeholder="000000"
                        value={code}
                        onChange={handleCodeChange}
                        disabled={loading}
                        className={[
                          "w-full rounded-lg px-4 py-2.5 text-sm text-textPrimary tracking-[0.4em]",
                          "bg-panel border border-panelBorder",
                          "placeholder:text-textMuted placeholder:tracking-normal",
                          "outline-none transition-shadow duration-200",
                          "focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-background",
                          "disabled:opacity-40 disabled:cursor-not-allowed",
                        ].join(" ")}
                        aria-label="6-digit reset code"
                        autoFocus
                      />
                      <p className="text-xs text-textMuted">
                        Can't find it? Check your spam folder.
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="primary"
                      disabled={loading || code.length !== 6}
                      className="w-full min-h-[44px] font-bold"
                      onClick={() => submitCode(code)}
                    >
                      {loading ? "Verifying…" : "Verify"}
                    </Button>

                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resendCooldown > 0 || loading}
                      className={[
                        "text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-node rounded",
                        resendCooldown > 0 || loading
                          ? "text-textMuted cursor-not-allowed"
                          : "text-node hover:brightness-125",
                      ].join(" ")}
                    >
                      {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : "Resend code"}
                    </button>

                    <button
                      type="button"
                      onClick={() => { setStep(1); setCode(""); setError(""); }}
                      className="text-xs text-textMuted hover:text-textPrimary transition-colors focus-visible:outline-none focus-visible:underline rounded text-left"
                    >
                      ← Use a different email
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── Step 3 ──────────────────────────────────────────────── */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col gap-6"
                >
                  <div className="flex flex-col gap-1">
                    <h1 className="font-sans text-xl font-bold text-textPrimary">
                      Create new password
                    </h1>
                    <p className="text-sm text-textMuted">
                      Choose a strong password for your account.
                    </p>
                  </div>

                  <form onSubmit={handleReset} noValidate className="flex flex-col gap-5">
                    <ErrorBanner message={error} />

                    <ThemedInput
                      id="fp-new-password"
                      label="New password"
                      type={showNew ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      hint="At least 8 characters"
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
                      required
                      disabled={loading}
                      rightSlot={
                        <button
                          type="button"
                          onClick={() => setShowNew((v) => !v)}
                          aria-label={showNew ? "Hide password" : "Show password"}
                          className="text-textMuted hover:text-textPrimary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-node rounded p-0.5 min-h-[44px] min-w-[44px] flex items-center justify-center"
                        >
                          {showNew ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                        </button>
                      }
                    />

                    <ThemedInput
                      id="fp-confirm-password"
                      label="Confirm new password"
                      type={showConfirm ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      errorMessage={confirmError}
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setConfirmError(""); }}
                      required
                      disabled={loading}
                      rightSlot={
                        <button
                          type="button"
                          onClick={() => setShowConfirm((v) => !v)}
                          aria-label={showConfirm ? "Hide password" : "Show password"}
                          className="text-textMuted hover:text-textPrimary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-node rounded p-0.5 min-h-[44px] min-w-[44px] flex items-center justify-center"
                        >
                          {showConfirm ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                        </button>
                      }
                    />

                    <Button
                      type="submit"
                      variant="primary"
                      disabled={loading}
                      className="w-full min-h-[44px] font-bold"
                    >
                      {loading ? "Saving…" : "Set new password"}
                    </Button>
                  </form>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </>
  );
}
