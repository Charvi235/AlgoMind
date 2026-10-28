import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import User from "../models/User";
import PendingSignup from "../models/PendingSignup";
import PasswordReset from "../models/PasswordReset";
import {
  generateOtp,
  hashOtp,
  verifyOtp,
  OTP_TTL_MS,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
} from "../utils/otp";
import { sendOtpEmail } from "../utils/mailer";
import {
  normalizeEmail,
  validateEmail,
  validatePassword,
  validateUsername,
  usernameKey,
} from "../utils/validators";

const SALT_ROUNDS = 10;
const SIGNUP_SESSION_MS = 30 * 60 * 1000; // time to pick a username after verifying
// A login for an unknown account should take as long as a real one.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", SALT_ROUNDS);

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const body = (req: Request): Record<string, unknown> => (req.body ?? {}) as Record<string, unknown>;

function signToken(userId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return jwt.sign({ userId }, secret, { expiresIn: "7d" });
}

function publicUser(user: InstanceType<typeof User>) {
  return { id: user.id, username: user.username, email: user.email, totalXP: user.totalXP };
}

const MAIL_FAILED = "We couldn't send the verification email. Please try again in a minute.";

// ── Step 1: email + password -> a code is emailed ────────────────────────
export async function signupStart(req: Request, res: Response, next: NextFunction) {
  try {
    const email = normalizeEmail(str(body(req).email));
    const password = str(body(req).password);

    const emailErr = validateEmail(email);
    if (emailErr) { res.status(400).json({ error: emailErr }); return; }
    const pwErr = validatePassword(password);
    if (pwErr) { res.status(400).json({ error: pwErr }); return; }

    if (await User.exists({ email })) {
      res.status(409).json({ error: "An account with this email already exists. Please log in." });
      return;
    }

    const existing = await PendingSignup.findOne({ email });
    if (existing) {
      const wait = OTP_RESEND_COOLDOWN_MS - (Date.now() - existing.lastSentAt.getTime());
      if (wait > 0) {
        res.status(429).json({
          error: `Please wait ${Math.ceil(wait / 1000)}s before requesting another code.`,
          retryAfterSeconds: Math.ceil(wait / 1000),
        });
        return;
      }
    }

    const otp = generateOtp();
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await PendingSignup.findOneAndUpdate(
      { email },
      {
        $set: {
          passwordHash,
          otpHash: hashOtp(otp),
          attempts: 0,
          lastSentAt: new Date(),
          verified: false,
          expiresAt: new Date(Date.now() + OTP_TTL_MS),
        },
        $unset: { signupTokenHash: 1 },
      },
      { upsert: true, returnDocument: "after" }
    );

    try {
      await sendOtpEmail(email, otp);
    } catch (mailErr) {
      console.error("Failed to send verification email:", mailErr);
      await PendingSignup.deleteOne({ email });
      res.status(502).json({ error: MAIL_FAILED });
      return;
    }

    res.json({ ok: true, resendAfterSeconds: OTP_RESEND_COOLDOWN_MS / 1000 });
  } catch (err) {
    next(err);
  }
}

// ── Step 2: check the code ──────────────────────────────────────────────
export async function signupVerify(req: Request, res: Response, next: NextFunction) {
  try {
    const email = normalizeEmail(str(body(req).email));
    const code = str(body(req).code).trim();
    if (!/^\d{6}$/.test(code)) {
      res.status(400).json({ error: "Enter the 6-digit code." });
      return;
    }

    // Count the attempt BEFORE checking it, atomically, so parallel
    // requests can't be used to try more than OTP_MAX_ATTEMPTS codes.
    const pending = await PendingSignup.findOneAndUpdate(
      { email, verified: false, attempts: { $lt: OTP_MAX_ATTEMPTS }, expiresAt: { $gt: new Date() } },
      { $inc: { attempts: 1 } },
      { returnDocument: "after" }
    );

    if (!pending) {
      const stale = await PendingSignup.findOne({ email, verified: false, expiresAt: { $gt: new Date() } });
      if (stale && stale.attempts >= OTP_MAX_ATTEMPTS) {
        res.status(429).json({ error: "Too many wrong attempts. Please request a new code." });
      } else {
        res.status(400).json({ error: "This code has expired. Please start again." });
      }
      return;
    }

    if (!verifyOtp(code, pending.otpHash)) {
      res.status(400).json({
        error: "Incorrect code.",
        attemptsLeft: Math.max(0, OTP_MAX_ATTEMPTS - pending.attempts),
      });
      return;
    }

    const signupToken = randomBytes(32).toString("hex");
    pending.verified = true;
    pending.signupTokenHash = hashOtp(signupToken);
    pending.expiresAt = new Date(Date.now() + SIGNUP_SESSION_MS);
    await pending.save();

    res.json({ ok: true, signupToken });
  } catch (err) {
    next(err);
  }
}

// ── Resend a fresh code ─────────────────────────────────────────────────
export async function signupResend(req: Request, res: Response, next: NextFunction) {
  try {
    const email = normalizeEmail(str(body(req).email));
    const pending = await PendingSignup.findOne({ email, verified: false, expiresAt: { $gt: new Date() } });
    if (!pending) {
      res.status(400).json({ error: "Your signup session expired. Please start again." });
      return;
    }

    const wait = OTP_RESEND_COOLDOWN_MS - (Date.now() - pending.lastSentAt.getTime());
    if (wait > 0) {
      res.status(429).json({
        error: `Please wait ${Math.ceil(wait / 1000)}s before requesting another code.`,
        retryAfterSeconds: Math.ceil(wait / 1000),
      });
      return;
    }

    const otp = generateOtp();
    pending.otpHash = hashOtp(otp);
    pending.attempts = 0;
    pending.lastSentAt = new Date();
    pending.expiresAt = new Date(Date.now() + OTP_TTL_MS);
    await pending.save();

    try {
      await sendOtpEmail(email, otp);
    } catch (mailErr) {
      console.error("Failed to resend verification email:", mailErr);
      pending.lastSentAt = new Date(0); // let them retry immediately
      await pending.save();
      res.status(502).json({ error: MAIL_FAILED });
      return;
    }

    res.json({ ok: true, resendAfterSeconds: OTP_RESEND_COOLDOWN_MS / 1000 });
  } catch (err) {
    next(err);
  }
}

// ── Step 3: choose a username -> the account is created ────────────────
export async function signupComplete(req: Request, res: Response, next: NextFunction) {
  try {
    const email = normalizeEmail(str(body(req).email));
    const signupToken = str(body(req).signupToken);
    const username = str(body(req).username).trim();

    const nameErr = validateUsername(username);
    if (nameErr) { res.status(400).json({ error: nameErr }); return; }

    const pending = await PendingSignup.findOne({ email, verified: true, expiresAt: { $gt: new Date() } });
    if (
      !pending ||
      !pending.signupTokenHash ||
      !/^[0-9a-f]{64}$/.test(signupToken) ||
      !verifyOtp(signupToken, pending.signupTokenHash)
    ) {
      res.status(400).json({ error: "Your verification expired. Please sign up again." });
      return;
    }

    try {
      const user = await User.create({
        username,
        usernameLower: usernameKey(username),
        email,
        passwordHash: pending.passwordHash,
      });
      await PendingSignup.deleteOne({ _id: pending._id });
      res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
    } catch (createErr) {
      const e = createErr as { code?: number; keyPattern?: Record<string, unknown> };
      if (e.code === 11000) {
        if (e.keyPattern && "email" in e.keyPattern) {
          await PendingSignup.deleteOne({ _id: pending._id });
          res.status(409).json({ error: "An account with this email already exists. Please log in." });
        } else {
          // The pending record is kept, so they can just try another username.
          res.status(409).json({ error: "That username is taken." });
        }
        return;
      }
      throw createErr;
    }
  } catch (err) {
    next(err);
  }
}

// ── Live "is this username free?" check ────────────────────────────────
export async function usernameAvailable(req: Request, res: Response, next: NextFunction) {
  try {
    const name = str(req.query.u).trim();
    const formatErr = validateUsername(name);
    if (formatErr) { res.json({ available: false, reason: formatErr }); return; }
    const taken = await User.exists({ usernameLower: usernameKey(name) });
    res.json(taken ? { available: false, reason: "That username is taken." } : { available: true });
  } catch (err) {
    next(err);
  }
}

// ── Login: email OR username ────────────────────────────────────────────
export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const identifier = (str(body(req).identifier) || str(body(req).email)).trim();
    const password = str(body(req).password);
    if (!identifier || !password) {
      res.status(400).json({ error: "Email or username, and password are required" });
      return;
    }

    const user = identifier.includes("@")
      ? await User.findOne({ email: normalizeEmail(identifier) })
      : await User.findOne({ usernameLower: usernameKey(identifier) });

    const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    res.json({ token: signToken(user.id), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    // req.userId is set by the authMiddleware
    const user = await User.findById((req as any).userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      totalXP: user.totalXP,
      current_streak: user.current_streak,
      longest_streak: user.longest_streak,
    });
  } catch (err) {
    next(err);
  }
}

// ── Password reset: step 1 — send code ─────────────────────────────────
// Always responds 200 so the endpoint cannot be used to discover accounts.
export async function passwordForgot(req: Request, res: Response, next: NextFunction) {
  try {
    const email = normalizeEmail(str(body(req).email));
    const emailErr = validateEmail(email);
    if (emailErr) { res.status(400).json({ error: emailErr }); return; }

    const ALWAYS_OK = { ok: true, resendAfterSeconds: OTP_RESEND_COOLDOWN_MS / 1000 };

    const user = await User.exists({ email });
    if (!user) {
      res.json(ALWAYS_OK);
      return;
    }

    // Respect the resend cooldown so the same code isn't spammed.
    const existing = await PasswordReset.findOne({ email });
    if (existing) {
      const wait = OTP_RESEND_COOLDOWN_MS - (Date.now() - existing.lastSentAt.getTime());
      if (wait > 0) {
        res.json(ALWAYS_OK);
        return;
      }
    }

    const otp = generateOtp();
    await PasswordReset.findOneAndUpdate(
      { email },
      {
        $set: {
          otpHash: hashOtp(otp),
          attempts: 0,
          lastSentAt: new Date(),
          verified: false,
          expiresAt: new Date(Date.now() + OTP_TTL_MS),
        },
        $unset: { resetTokenHash: 1 },
      },
      { upsert: true, returnDocument: "after" },
    );

    try {
      await sendOtpEmail(email, otp, "reset");
    } catch (mailErr) {
      console.error("Failed to send password reset email:", mailErr);
      await PasswordReset.deleteOne({ email });
      // Still respond 200 — don't reveal that the account exists.
    }

    res.json(ALWAYS_OK);
  } catch (err) {
    next(err);
  }
}

// ── Password reset: step 2 — verify code ────────────────────────────────
export async function passwordVerify(req: Request, res: Response, next: NextFunction) {
  try {
    const email = normalizeEmail(str(body(req).email));
    const code  = str(body(req).code).trim();

    // Atomic increment before comparing (same pattern as signupVerify).
    const record = await PasswordReset.findOneAndUpdate(
      {
        email,
        verified: false,
        attempts: { $lt: OTP_MAX_ATTEMPTS },
        expiresAt: { $gt: new Date() },
      },
      { $inc: { attempts: 1 } },
      { returnDocument: "after" },
    );

    if (!record) {
      // Check if attempts are exhausted vs expired/not-found.
      const stale = await PasswordReset.findOne({
        email,
        verified: false,
        expiresAt: { $gt: new Date() },
      });
      if (stale && stale.attempts >= OTP_MAX_ATTEMPTS) {
        res.status(429).json({ error: "Too many wrong attempts. Please request a new code." });
      } else {
        res.status(400).json({ error: "Incorrect or expired code." });
      }
      return;
    }

    if (!verifyOtp(code, record.otpHash)) {
      res.status(400).json({
        error: "Incorrect or expired code.",
        attemptsLeft: Math.max(0, OTP_MAX_ATTEMPTS - record.attempts),
      });
      return;
    }

    const resetToken = randomBytes(32).toString("hex");
    const RESET_SESSION_MS = 30 * 60 * 1000;
    record.verified        = true;
    record.resetTokenHash  = hashOtp(resetToken);
    record.expiresAt       = new Date(Date.now() + RESET_SESSION_MS);
    await record.save();

    res.json({ ok: true, resetToken });
  } catch (err) {
    next(err);
  }
}

// ── Password reset: step 3 — set new password ────────────────────────────
export async function passwordReset(req: Request, res: Response, next: NextFunction) {
  try {
    const email       = normalizeEmail(str(body(req).email));
    const resetToken  = str(body(req).resetToken);
    const newPassword = str(body(req).newPassword);

    const pwErr = validatePassword(newPassword);
    if (pwErr) { res.status(400).json({ error: pwErr }); return; }

    const EXPIRED = "Your reset session expired. Please start again.";

    const record = await PasswordReset.findOne({
      email,
      verified: true,
      expiresAt: { $gt: new Date() },
    });

    if (
      !record ||
      !record.resetTokenHash ||
      !/^[0-9a-f]{64}$/.test(resetToken) ||
      !verifyOtp(resetToken, record.resetTokenHash)
    ) {
      res.status(400).json({ error: EXPIRED });
      return;
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Account deleted between the reset request and now.
      await PasswordReset.deleteOne({ email });
      res.status(400).json({ error: EXPIRED });
      return;
    }

    user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await user.save();
    await PasswordReset.deleteOne({ email });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}