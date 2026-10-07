/**
 * auth.ts
 *
 * Tiny token-storage helper. The login/signup UI (not built yet) will
 * call setToken() after a successful login — everything else (socket
 * auth, session-save calls) already reads from here, so no rework
 * needed when that UI is added.
 */

const TOKEN_KEY = "algomind_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}