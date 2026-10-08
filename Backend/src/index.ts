import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import authRoutes from "./routes/authRoutes";
import { Server as SocketIOServer } from "socket.io";
import { connectDB } from "./config/db";
import { errorHandler } from "./middleware/errorHandler";
import dijkstraRoutes from "./routes/dijkstraRoutes";
import sessionRoutes from "./routes/sessionRoutes";
import { registerSocketHandlers } from "./sockets/socketHandlers";

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

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});
app.use("/api/games/dijkstra", dijkstraRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/sessions", sessionRoutes);

app.use(errorHandler);

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