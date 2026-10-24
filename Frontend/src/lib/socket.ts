import { io, Socket } from "socket.io-client";
import { getToken } from "./auth";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ["websocket"],
  auth: (cb) => {
    const token = getToken();
    cb({
      token: token ?? "",
      guest: !token,
      username: "Guest",
    });
  },
});
