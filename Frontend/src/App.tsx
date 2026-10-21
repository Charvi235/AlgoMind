import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import AppLayout from "./components/AppLayout";

// ── Core pages ────────────────────────────────────────────────────────────────
import Dashboard            from "./pages/Dashboard";
import Leaderboard          from "./pages/Leaderboard";

// ── Auth / landing pages (own layout — no Navbar) ─────────────────────────────
import LandingPage          from "./pages/LandingPage";
import LoginPage            from "./pages/LoginPage";
import SignupPage           from "./pages/SignupPage";

// ── Shared game-flow pages ────────────────────────────────────────────────────
import GameModeSelect       from "./pages/GameModeSelect";
import FriendModeSelect     from "./pages/FriendModeSelect";

// ── Session pages ─────────────────────────────────────────────────────────────
import SoloSession          from "./pages/SoloSession";
import LiveMatch            from "./pages/LiveMatch";
import ResultsScreen        from "./pages/ResultsScreen";

// ── Multiplayer lobby pages ───────────────────────────────────────────────────
import RandomQueue          from "./pages/RandomQueue";
import InviteScreen         from "./pages/InviteScreen";
import JoinRoomScreen       from "./pages/JoinRoomScreen";
import JoinRedirect         from "./pages/JoinRedirect";

// ─── Page transition ──────────────────────────────────────────────────────────
const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0  },
  exit:    { opacity: 0, y: -8 },
};

const pageTransition = { duration: 0.25, ease: "easeInOut" as const };

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
    >
      {children}
    </motion.div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>

        {/* ── Public pages — own layout (no Navbar) ──────────────────── */}
        <Route path="/" element={
          <PageWrapper><LandingPage /></PageWrapper>
        } />
        <Route path="/login" element={
          <PageWrapper><LoginPage /></PageWrapper>
        } />
        <Route path="/signup" element={
          <PageWrapper><SignupPage /></PageWrapper>
        } />

        {/* ── App pages — inside AppLayout (with Navbar) ─────────────── */}
        <Route path="/dashboard" element={
          <AppLayout><PageWrapper><Dashboard /></PageWrapper></AppLayout>
        } />
        <Route path="/leaderboard" element={
          <AppLayout><PageWrapper><Leaderboard /></PageWrapper></AppLayout>
        } />

        {/* ── Shared game flow ─────────────────────────────────────────── */}
        <Route path="/game/:gameType" element={
          <AppLayout><PageWrapper><GameModeSelect /></PageWrapper></AppLayout>
        } />
        <Route path="/game/:gameType/solo" element={
          <AppLayout><PageWrapper><SoloSession /></PageWrapper></AppLayout>
        } />
        <Route path="/game/:gameType/match/:roomId" element={
          <AppLayout><PageWrapper><LiveMatch /></PageWrapper></AppLayout>
        } />
        <Route path="/game/:gameType/results" element={
          <AppLayout><PageWrapper><ResultsScreen /></PageWrapper></AppLayout>
        } />
        <Route path="/game/:gameType/friends" element={
          <AppLayout><PageWrapper><FriendModeSelect /></PageWrapper></AppLayout>
        } />

        {/* ── Multiplayer lobby ─────────────────────────────────────────── */}
        <Route path="/game/:gameType/queue" element={
          <AppLayout><PageWrapper><RandomQueue /></PageWrapper></AppLayout>
        } />
        <Route path="/game/:gameType/invite" element={
          <AppLayout><PageWrapper><InviteScreen /></PageWrapper></AppLayout>
        } />
        <Route path="/game/:gameType/join" element={
          <AppLayout><PageWrapper><JoinRoomScreen /></PageWrapper></AppLayout>
        } />
        <Route path="/join-room" element={
          <AppLayout><PageWrapper><JoinRoomScreen /></PageWrapper></AppLayout>
        } />

        {/* ── Deep-link entry point ─────────────────────────────────────── */}
        <Route path="/join/:roomCode" element={
          <AppLayout><PageWrapper><JoinRedirect /></PageWrapper></AppLayout>
        } />

      </Routes>
    </AnimatePresence>
  );
}
