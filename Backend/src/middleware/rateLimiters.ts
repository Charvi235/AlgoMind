import rateLimit from "express-rate-limit";
import type { Request } from "express";

const tooMany = (message: string) => ({ error: message });

const common = {
  standardHeaders: "draft-7" as const,
  legacyHeaders: false,
};

// Many students can share one public IP (college Wi-Fi), so the per-IP
// limits are deliberately generous. The tight limits are per email / account.

export const signupStartIpLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  limit: 100,
  message: tooMany("Too many signup attempts from this network. Please try again in a while."),
});

// Protects the free email quota (Brevo: 300/day). Only requests that
// succeeded (an email was sent) count, so invalid requests can't burn it.
export const signupStartDailyLimiter = rateLimit({
  ...common,
  windowMs: 24 * 60 * 60 * 1000,
  limit: 250,
  skipFailedRequests: true,
  keyGenerator: () => "all-signups",
  message: tooMany("Signups are very busy right now. Please try again later today."),
});

export const resendIpLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  limit: 100,
  message: tooMany("Too many code requests. Please try again in a while."),
});

export const verifyIpLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 200,
  message: tooMany("Too many attempts. Please try again in a few minutes."),
});

export const usernameCheckLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  limit: 300,
  message: tooMany("Too many requests. Please slow down."),
});

// Login: only FAILED attempts count (success responses are skipped).
export const loginIpLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 60,
  skipSuccessfulRequests: true,
  message: tooMany("Too many failed logins from this network. Please try again later."),
});

export const loginAccountLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req: Request) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const id =
      typeof b.identifier === "string" ? b.identifier :
      typeof b.email === "string" ? b.email : "";
    return "acct:" + id.trim().toLowerCase();
  },
  message: tooMany("Too many failed logins for this account. Please try again in 15 minutes."),
});