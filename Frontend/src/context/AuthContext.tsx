/**
 * AuthContext.tsx
 *
 * App-wide authentication state.
 *
 * Exports:
 *   AuthProvider  — mount once, inside <BrowserRouter>, wrapping <App>
 *   useAuth       — hook for any component that needs auth state / actions
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { getToken, setToken, clearToken } from "../lib/auth";
import { socket } from "../lib/socket";
import { apiPost, ApiError } from "../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id:              string;
  username:        string;
  email:           string;
  totalXP:         number;
  current_streak:  number;
  longest_streak:  number;
}

interface AuthContextValue {
  user:       AuthUser | null;
  loading:    boolean;
  login:      (identifier: string, password: string) => Promise<void>;
  logout:     () => void;
  /** Called after signup/complete to store the session without a separate /me round-trip. */
  setSession: (token: string, user: Pick<AuthUser, "id" | "username" | "email" | "totalXP">) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── API base ─────────────────────────────────────────────────────────────────

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Initial check: if a token exists, validate it with /api/auth/me ──────
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    fetch(`${API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (res.ok) {
          const data: AuthUser = await res.json();
          setUser(data);
        } else if (res.status === 401) {
          // Token is invalid or expired — discard it.
          clearToken();
        }
        // Any other status (500, network-level ok but API error):
        // leave the token alone; treat as a transient failure.
      })
      .catch(() => {
        // Network error — do NOT clear the token; user may just be offline.
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // ── login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (identifier: string, password: string) => {
    const data = await apiPost<{
      token: string;
      user:  Pick<AuthUser, "id" | "username" | "email" | "totalXP">;
    }>("/api/auth/login", { identifier, password }).catch((err) => {
      if (err instanceof ApiError) throw err;
      throw err;
    });

    setToken(data.token);

    // Disconnect so the next connection picks up the new token.
    socket.disconnect();

    // The /me shape includes streak fields; /login only returns core fields.
    // Populate streak fields with 0 until the next /me call (e.g. on refresh).
    setUser({
      ...data.user,
      current_streak: 0,
      longest_streak: 0,
    });
  }, []);

  // ── setSession ────────────────────────────────────────────────────────────
  // Used by the signup flow after /signup/complete so SignupPage can hand
  // control to the app without a separate /me round-trip.
  const setSession = useCallback(
    (token: string, userData: Pick<AuthUser, "id" | "username" | "email" | "totalXP">) => {
      setToken(token);
      socket.disconnect();
      setUser({
        ...userData,
        current_streak: 0,
        longest_streak: 0,
      });
    },
    [],
  );

  // ── logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    socket.disconnect();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setSession }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
