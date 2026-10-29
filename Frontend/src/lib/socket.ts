import { io, Socket } from "socket.io-client";
import { getToken, clearToken } from "./auth";

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


// If the server rejects the connection because the token is missing, invalid,
// or expired, clear the stored token and send the user to /login.
// All other connect_error cases (network down, etc.) are handled by the
// individual pages that already show "Can't reach the server".
socket.on("connect_error", (err: Error) => {
  if (err.message === "AUTH_REQUIRED") {
    clearToken();
    const { pathname } = window.location;
    if (pathname !== "/login" && pathname !== "/signup") {
      window.location.assign("/login");
    }
  }
});

