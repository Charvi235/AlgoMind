import { createHmac, randomInt, timingSafeEqual } from "crypto";

export const OTP_TTL_MS = 10 * 60 * 1000;          // code valid for 10 minutes
export const OTP_MAX_ATTEMPTS = 5;                 // wrong tries before lockout
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;   // min gap between sends

export function generateOtp(): string {
  return String(randomInt(0, 1000000)).padStart(6, "0");
}

// HMAC keyed with JWT_SECRET: a leaked database alone can't be used to
// brute-force the 1,000,000 possible codes offline.
export function hashOtp(otp: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return createHmac("sha256", secret).update(otp).digest("hex");
}

export function verifyOtp(otp: string, expectedHash: string): boolean {
  const a = Buffer.from(hashOtp(otp), "hex");
  const b = Buffer.from(expectedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}