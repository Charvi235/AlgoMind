export const USERNAME_MIN = 7;
export const USERNAME_MAX = 20;
export const PASSWORD_MIN = 8;

// Small built-in list of common throwaway-mail domains. Can be swapped for
// a maintained package later.
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "temp-mail.org",
  "tempmail.com", "yopmail.com", "sharklasers.com", "trashmail.com",
  "getnada.com", "throwawaymail.com", "maildrop.cc", "dispostable.com",
  "fakeinbox.com", "mailnesia.com", "mintemail.com", "mohmal.com",
]);

// Compared with dots/underscores/hyphens removed, so "algo.mind" is blocked too.
const RESERVED = new Set([
  "admin", "administrator", "algomind", "algomindofficial", "moderator",
  "official", "support", "security", "staff", "helpdesk", "system", "root",
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_CHARS = /^[A-Za-z0-9_.-]+$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateEmail(email: string): string | null {
  if (email.length > 254 || !EMAIL_RE.test(email)) return "Enter a valid email address.";
  const domain = email.split("@")[1];
  if (DISPOSABLE_DOMAINS.has(domain)) return "Disposable email addresses are not allowed.";
  return null;
}

export function validatePassword(pw: string): string | null {
  if (pw.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  // bcrypt only uses the first 72 bytes, so longer passwords would be silently truncated.
  if (Buffer.byteLength(pw, "utf8") > 72) return "Password is too long (max 72 bytes).";
  return null;
}

export function validateUsername(name: string): string | null {
  if (name.length < USERNAME_MIN) return `Username must be at least ${USERNAME_MIN} characters.`;
  if (name.length > USERNAME_MAX) return `Username can be at most ${USERNAME_MAX} characters.`;
  if (!USERNAME_CHARS.test(name)) return "Use only letters, numbers, underscore (_), dot (.) and hyphen (-).";
  if (!/[A-Za-z]/.test(name)) return "Username must contain at least one letter.";
  if (/^[_.-]|[_.-]$/.test(name)) return "Username cannot start or end with _ . or -";
  if (RESERVED.has(name.toLowerCase().replace(/[_.-]/g, ""))) return "This username is not available.";
  return null;
}

// Case-insensitive uniqueness key: "Charvi_23" and "charvi_23" are the same name.
export function usernameKey(name: string): string {
  return name.toLowerCase();
}