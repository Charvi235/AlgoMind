import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { connectDB } from "./config/db";
import { errorHandler } from "./middleware/errorHandler";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());

// ─── Health check ──────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ─── Error handler (must be last) ──────────────────────────────
app.use(errorHandler);

// ─── HTTP + Socket.io server ───────────────────────────────────
const server = http.createServer(app);
export const io = new SocketIOServer(server, {
  cors: { origin: CLIENT_URL, credentials: true },
});

async function start() {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

start();