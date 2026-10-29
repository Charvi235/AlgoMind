import { getToken, clearToken } from "./auth";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const TIMEOUT_MS = 10000;

async function post<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const token = getToken();
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (res.status === 401) {
      clearToken();
      window.location.assign("/login");
      throw new Error("Please log in again.");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error ?? "Request failed");
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

export interface SoloResult {
  roundsCompleted: number;
  accuracy: number;
  xp: number;
}

export const startSoloSession = (gameType: string) =>
  post<{ sessionId: string; durationSeconds: number }>("/api/sessions/solo/start", { gameType });

export const finishSoloSession = (sessionId: string) =>
  post<SoloResult>("/api/sessions/solo/finish", { sessionId });