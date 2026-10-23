import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { connectDB } from "./config/db";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/authRoutes";
import dijkstraRoutes from "./routes/dijkstraRoutes";
import bstRoutes from "./routes/bstRoutes";
import sessionRoutes from "./routes/sessionRoutes";
import { registerSocketHandlers } from "./sockets/socketHandlers";
import sortingRoutes from "./routes/sortingRoutes";
import { registerSortingSocketHandlers } from "./sockets/sortingSocketHandlers";

dotenv.config();

// Fail fast: a missing secret must crash the deploy loudly, never
// silently turn every user into a guest or break auth.
const REQUIRED_ENV = ["MONGODB_URI", "JWT_SECRET"];
for (const name of REQUIRED_ENV) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}
if (process.env.NODE_ENV === "production" && !process.env.CLIENT_URL) {
  throw new Error("CLIENT_URL must be set in production, otherwise CORS rejects the real frontend");
}

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

// Behind Render's proxy every request looks like it comes from the proxy's IP,
// which would make per-IP limits count ALL users as one. TRUST_PROXY_HOPS says
// how many proxies to trust when reading X-Forwarded-For (0 = none, local dev).
// Never use `true`: clients could then spoof their IP.
const TRUST_PROXY_HOPS = Number(process.env.TRUST_PROXY_HOPS ?? 0);
if (Number.isInteger(TRUST_PROXY_HOPS) && TRUST_PROXY_HOPS >= 0) {
  app.set("trust proxy", TRUST_PROXY_HOPS);
}

// Temporary helper to measure the right hop count after deploying.
// Only exists while DEBUG_IP=1 is set. Remove the variable when done.
if (process.env.DEBUG_IP === "1") {
  app.get("/api/debug/ip", (req, res) => {
    res.json({ ip: req.ip, xForwardedFor: req.headers["x-forwarded-for"] ?? null });
  });
}


app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/games/dijkstra", dijkstraRoutes);
app.use("/api/games/bst", bstRoutes);
app.use("/api/games/sorting", sortingRoutes);
// ─── Error handler (must be last) ──────────────────────────────
app.use(errorHandler);

const server = http.createServer(app);
export const io = new SocketIOServer(server, {
  cors: { origin: CLIENT_URL, credentials: true },
});
registerSortingSocketHandlers(io);
registerSocketHandlers(io);

async function start() {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

start();