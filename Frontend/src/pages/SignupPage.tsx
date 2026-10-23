/**
 * SignupPage.tsx
 *
 * Route: /signup
 * Own layout — StarfieldBackground + centered card, no Navbar.
 *
 * Three-step flow:
 *   Step 1 "Create account"  — email + password → POST /api/auth/signup/start
 *   Step 2 "Verify email"    — 6-digit OTP      → POST /api/auth/signup/verify
 *   Step 3 "Choose username" — username check   → POST /api/auth/signup/complete
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Sparkles, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import StarfieldBackground from "../components/StarfieldBackground";
import Button from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import { apiPost, apiGet, ApiError } from "../lib/api";

// ─── Google "G" SVG ──────────────────────────────────────────────────────────

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
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
  hint?:         string;
  errorMessage?: string;
  rightSlot?:    React.ReactNode;
}

function ThemedInput({
  label,
  id,
  hint,
  errorMessage,
  rightSlot,
  className = "",
  ...rest
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
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-textMuted">{hint}</p>
      )}
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

// ─── Step indicator ───────────────────────────────────────────────────────────

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

// ─── Inline error banner ──────────────────────────────────────────────────────

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

// ─── Username availability states ─────────────────────────────────────────────

type AvailState = "idle" | "checking" | "available" | "unavailable";

// ─── Main component ───────────────────────────────────────────────────────────

export default function SignupPage() {
  const navigate            = useNavigate();
  const { setSession, user } = useAuth();

  // Already logged in
  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  // ── Shared state ───────────────────────────────────────────────────────────
  const [step,    setStep]    = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  // Step 1
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Step 2
  const [code,               setCode]               = useState("");
  const [resendCooldown,     setResendCooldown]      = useState(0);
  const [signupToken,        setSignupToken]         = useState("");   // kept in state only
  const resendTimerRef                               = useRef<ReturnType<typeof setInterval> | null>(null);

  // Step 3
  const [username,      setUsername]      = useState("");
  const [availState,    setAvailState]    = useState<AvailState>("idle");
  const [availReason,   setAvailReason]   = useState("");
  const debounceRef                       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestCheckRef                    = useRef(0);           // stale-response guard

  // ── Cooldown ticker ────────────────────────────────────────────────────────
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

  useEffect(() => () => {
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    if (debounceRef.current)    clearTimeout(debounceRef.current);
  }, []);

  // ── Step 1 submit ──────────────────────────────────────────────────────────
  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const data = await apiPost<{ ok: boolean; resendAfterSeconds: number }>(
        "/api/auth/signup/start",
        { email, password },
      );
      startResendCooldown(data.resendAfterSeconds);
      setStep(2);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("__exists__");          // rendered specially below
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: verify OTP ─────────────────────────────────────────────────────
  const submitCode = useCallback(async (codeValue: string) => {
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const data = await apiPost<{ ok: boolean; signupToken: string }>(
        "/api/auth/signup/verify",
        { email, code: codeValue },
      );
      setSignupToken(data.signupToken);
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
        "/api/auth/signup/resend",
        { email },
      );
      startResendCooldown(data.resendAfterSeconds);
      setCode("");
    } catch (err) {
      if (err instanceof ApiError && err.retryAfterSeconds != null) {
        startResendCooldown(err.retryAfterSeconds);
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Could not resend code.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: username availability debounce ─────────────────────────────────
  const checkUsername = useCallback((value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.length < 7) {
      setAvailState("idle");
      setAvailReason("");
      return;
    }

    setAvailState("checking");
    const reqId = ++latestCheckRef.current;

    debounceRef.current = setTimeout(async () => {
      try {
        const data = await apiGet<{ available: boolean; reason?: string }>(
          `/api/auth/username-available?u=${encodeURIComponent(value)}`,
        );
        if (reqId !== latestCheckRef.current) return;   // stale
        if (data.available) {
          setAvailState("available");
          setAvailReason("");
        } else {
          setAvailState("unavailable");
          setAvailReason(data.reason ?? "Username not available.");
        }
      } catch {
        if (reqId !== latestCheckRef.current) return;
        setAvailState("idle");
        setAvailReason("");
      }
    }, 400);
  }, []);

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUsername(val);
    setError("");
    checkUsername(val);
  };

  // ── Step 3 submit ──────────────────────────────────────────────────────────
  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || availState !== "available") return;
    setError("");
    setLoading(true);
    try {
      const data = await apiPost<{
        token: string;
        user:  { id: string; username: string; email: string; totalXP: number };
      }>("/api/auth/signup/complete", { email, signupToken, username });
      setSession(data.token, data.user);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete signup.");
    } finally {
      setLoading(false);
    }
  };

  // ── Shared card shell ──────────────────────────────────────────────────────
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
            <Sparkles size={20} className="text-gold drop-shadow-[0_0_6px_#FFD36E] group-hover:animate-twinkle" aria-hidden="true" />
            <span className="font-sans text-xl font-bold tracking-tight text-gold drop-shadow-[0_0_8px_#FFD36E99]">
              AlgoMind
            </span>
          </Link>

          <div className="rounded-2xl border border-panelBorder bg-panel p-8 shadow-panel flex flex-col gap-6">

            {/* Step dots */}
            <StepDots current={step} total={3} />

            {/* ── Step 1 ─────────────────────────────────────────────────── */}
            <AnimatePresence mode="wait" initial={false}>
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
                      Create your account
                    </h1>
                    <p className="text-sm text-textMuted">
                      Start mastering algorithms in 60-second battles.
                    </p>
                  </div>

                  <form onSubmit={handleStart} noValidate className="flex flex-col gap-5">
                    {error === "__exists__" ? (
                      <p role="alert" aria-live="assertive" className="rounded-lg border border-error/40 bg-error/10 px-4 py-2.5 text-sm text-error">
                        An account with that email already exists.{" "}
                        <Link to="/login" className="font-semibold underline underline-offset-2 hover:brightness-125">
                          Log in instead?
                        </Link>
                      </p>
                    ) : (
                      <ErrorBanner message={error} />
                    )}

                    <ThemedInput
                      id="signup-email"
                      label="Email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(""); }}
                      required
                      disabled={loading}
                    />

                    <ThemedInput
                      id="signup-password"
                      label="Password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      hint="At least 8 characters"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(""); }}
                      required
                      disabled={loading}
                      rightSlot={
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          className="text-textMuted hover:text-textPrimary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-node rounded p-0.5 min-h-[44px] min-w-[44px] flex items-center justify-center"
                        >
                          {showPassword
                            ? <EyeOff size={16} aria-hidden="true" />
                            : <Eye    size={16} aria-hidden="true" />
                          }
                        </button>
                      }
                    />

                    <Button type="submit" variant="primary" disabled={loading} className="w-full min-h-[44px] font-bold">
                      {loading ? "Creating account…" : "Create account"}
                    </Button>
                  </form>

                  <Divider label="or" />

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
                    onClick={() => console.log("[SignupPage] Google sign-in clicked")}
                  >
                    <GoogleG />
                    Continue with Google
                  </button>

                  <p className="text-center text-sm text-textMuted">
                    Already have an account?{" "}
                    <Link
                      to="/login"
                      className="font-medium text-node hover:brightness-125 transition-all underline underline-offset-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-node rounded"
                    >
                      Log in
                    </Link>
                  </p>
                </motion.div>
              )}

              {/* ── Step 2 ───────────────────────────────────────────────── */}
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
                      Verify your email
                    </h1>
                    <p className="text-sm text-textMuted">
                      We sent a 6-digit code to{" "}
                      <span className="font-medium text-textPrimary">{email}</span>.
                    </p>
                  </div>

                  <div className="flex flex-col gap-5">
                    <ErrorBanner message={error} />

                    {/* OTP input */}
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="signup-otp" className="text-sm font-medium text-textPrimary select-none">
                        Verification code
                      </label>
                      <input
                        id="signup-otp"
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
                        aria-label="6-digit verification code"
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

                    {/* Resend */}
                    <div className="flex items-center justify-between text-sm">
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={resendCooldown > 0 || loading}
                        className={[
                          "font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-node rounded",
                          resendCooldown > 0 || loading
                            ? "text-textMuted cursor-not-allowed"
                            : "text-node hover:brightness-125",
                        ].join(" ")}
                      >
                        {resendCooldown > 0
                          ? `Resend code (${resendCooldown}s)`
                          : "Resend code"}
                      </button>
                    </div>

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

              {/* ── Step 3 ───────────────────────────────────────────────── */}
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
                      Choose a username
                    </h1>
                    <p className="text-sm text-textMuted">
                      This is how other players will see you.
                    </p>
                  </div>

                  <form onSubmit={handleComplete} noValidate className="flex flex-col gap-5">
                    <ErrorBanner message={error} />

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="signup-username" className="text-sm font-medium text-textPrimary select-none">
                        Username
                      </label>
                      <div className="relative">
                        <input
                          id="signup-username"
                          type="text"
                          autoComplete="username"
                          placeholder="cool_coder42"
                          value={username}
                          onChange={handleUsernameChange}
                          disabled={loading}
                          maxLength={20}
                          className={[
                            "w-full rounded-lg px-4 py-2.5 pr-10 text-sm text-textPrimary",
                            "bg-panel border border-panelBorder",
                            "placeholder:text-textMuted",
                            "outline-none transition-shadow duration-200",
                            "focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-background",
                            "disabled:opacity-40 disabled:cursor-not-allowed",
                            availState === "unavailable" ? "border-error focus:ring-error" : "",
                            availState === "available"   ? "border-green-500/60 focus:ring-green-500/60" : "",
                          ].filter(Boolean).join(" ")}
                          aria-describedby="username-status username-rules"
                          autoFocus
                        />
                        {/* availability icon */}
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                          {availState === "checking"    && <Loader2     size={15} className="animate-spin text-textMuted"  aria-hidden="true" />}
                          {availState === "available"   && <CheckCircle2 size={15} className="text-green-400"              aria-hidden="true" />}
                          {availState === "unavailable" && <XCircle      size={15} className="text-error"                  aria-hidden="true" />}
                        </div>
                      </div>

                      {/* Live availability feedback */}
                      <p
                        id="username-status"
                        aria-live="polite"
                        className={[
                          "min-h-[1rem] text-xs",
                          availState === "checking"    ? "text-textMuted"  : "",
                          availState === "available"   ? "text-green-400"  : "",
                          availState === "unavailable" ? "text-error"      : "",
                        ].filter(Boolean).join(" ")}
                      >
                        {availState === "checking"    && "Checking…"}
                        {availState === "available"   && "Available"}
                        {availState === "unavailable" && availReason}
                      </p>

                      {/* Rules */}
                      <ul id="username-rules" className="text-xs text-textMuted space-y-0.5 list-disc list-inside">
                        <li>7–20 characters</li>
                        <li>Letters, numbers, <code className="font-mono">_</code> <code className="font-mono">.</code> <code className="font-mono">-</code> only</li>
                        <li>At least one letter</li>
                        <li>Cannot start or end with <code className="font-mono">_</code> <code className="font-mono">.</code> <code className="font-mono">-</code></li>
                      </ul>
                    </div>

                    <Button
                      type="submit"
                      variant="primary"
                      disabled={loading || availState !== "available"}
                      className="w-full min-h-[44px] font-bold"
                    >
                      {loading ? "Finishing…" : "Finish"}
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
