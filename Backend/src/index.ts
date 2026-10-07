import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import authRoutes from "./routes/authRoutes";
import { Server as SocketIOServer } from "socket.io";
import { connectDB } from "./config/db";
import { errorHandler } from "./middleware/errorHandler";
import dijkstraRoutes from "./routes/dijkstraRoutes";
import { registerSocketHandlers } from "./sockets/socketHandlers";

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
app.use("/api/games/dijkstra", dijkstraRoutes);
app.use("/api/auth", authRoutes);
import sessionRoutes from "./routes/sessionRoutes";
// ─── Error handler (must be last) ──────────────────────────────
app.use(errorHandler);

// ─── HTTP + Socket.io server ───────────────────────────────────
const server = http.createServer(app);
export const io = new SocketIOServer(server, {
  cors: { origin: CLIENT_URL, credentials: true },
});

registerSocketHandlers(io);

async function start() {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

start();