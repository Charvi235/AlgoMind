/**
 * api.ts
 *
 * Shared JSON fetch helper used by auth pages.
 *
 * Features:
 *  - 10 s AbortController timeout on every request
 *  - Parses {error, retryAfterSeconds, attemptsLeft} from error bodies
 *  - Throws ApiError so callers can inspect extra fields
 *  - Network failures throw a user-friendly message
 */

import { getToken, clearToken } from "./auth";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

// ─── Error type ───────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status:              number;
  retryAfterSeconds?:  number;
  attemptsLeft?:       number;

  constructor(
    message:             string,
    status:              number,
    retryAfterSeconds?:  number,
    attemptsLeft?:       number,
  ) {
    super(message);
    this.name               = "ApiError";
    this.status             = status;
    this.retryAfterSeconds  = retryAfterSeconds;
    this.attemptsLeft       = attemptsLeft;
  }
}

// ─── Core helper ─────────────────────────────────────────────────────────────

export async function apiFetch<T = unknown>(
  path:    string,
  options: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 10_000);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal:  controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    });
  } catch (err) {
    // AbortError means our timeout fired; anything else is a network failure.
    throw new Error("Can't reach the server. Check your connection and try again.");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    let body: Record<string, unknown> = {};
    try { body = await res.json(); } catch { /* ignore parse failures */ }

    throw new ApiError(
      typeof body.error === "string" ? body.error : `Request failed (${res.status})`,
      res.status,
      typeof body.retryAfterSeconds === "number" ? body.retryAfterSeconds : undefined,
      typeof body.attemptsLeft      === "number" ? body.attemptsLeft      : undefined,
    );
  }

  return res.json() as Promise<T>;
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

export function apiPost<T = unknown>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export function apiGet<T = unknown>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: "GET" });
}

/**
 * Authenticated GET: attaches the stored Bearer token.
 * On 401 clears the token and redirects to /login (matching soloApi.ts behaviour).
 */
export async function apiAuthGet<T = unknown>(path: string): Promise<T> {
  const token = getToken();
  try {
    return await apiFetch<T>(path, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      clearToken();
      window.location.assign("/login");
    }
    throw err;
  }
}
