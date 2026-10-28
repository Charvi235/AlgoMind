// Shared rules for server-scored solo sessions.
export const XP_PER_ROUND = 10;
export const SOLO_SESSION_SECONDS = 60;
export const SOLO_GRACE_MS = 5000;      // network latency tolerance
export const SOLO_MAX_ROUNDS = 50;      // upper bound for one 60-second session
export const SOLO_MIN_ROUND_MS = 800;   // faster than this is not human play

// Games whose solo sessions are scored by the server.
export const SOLO_SCORED_GAMES = new Set(["dijkstra"]);