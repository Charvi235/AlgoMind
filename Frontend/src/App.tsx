import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import AppLayout from "./components/AppLayout";

// ── Core pages ────────────────────────────────────────────────────────────────
import Dashboard            from "./pages/Dashboard";
import Leaderboard          from "./pages/Leaderboard";

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
    <AppLayout>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>

          {/* ── Core ──────────────────────────────────────────────────── */}
          <Route path="/" element={
            <PageWrapper><Dashboard /></PageWrapper>
          } />
          <Route path="/leaderboard" element={
            <PageWrapper><Leaderboard /></PageWrapper>
          } />

          {/* ── Shared game flow ─────────────────────────────────────── */}
          {/* Step 1: solo vs friends */}
          <Route path="/game/:gameType" element={
            <PageWrapper><GameModeSelect /></PageWrapper>
          } />
          {/* Step 2 (solo): 60-second session */}
          <Route path="/game/:gameType/solo" element={
            <PageWrapper><SoloSession /></PageWrapper>
          } />
          {/* Step 2 (live): multiplayer match */}
          <Route path="/game/:gameType/match/:roomId" element={
            <PageWrapper><LiveMatch /></PageWrapper>
          } />
          {/* Step 3 (both): results screen */}
          <Route path="/game/:gameType/results" element={
            <PageWrapper><ResultsScreen /></PageWrapper>
          } />
          {/* Step 2 (friends sub-mode chooser) */}
          <Route path="/game/:gameType/friends" element={
            <PageWrapper><FriendModeSelect /></PageWrapper>
          } />

          {/* ── Multiplayer lobby ────────────────────────────────────── */}
          <Route path="/game/:gameType/queue" element={
            <PageWrapper><RandomQueue /></PageWrapper>
          } />
          <Route path="/game/:gameType/invite" element={
            <PageWrapper><InviteScreen /></PageWrapper>
          } />
          <Route path="/game/:gameType/join" element={
            <PageWrapper><JoinRoomScreen /></PageWrapper>
          } />
          {/* Guest entering code without a gameType in URL (from JoinRedirect) */}
          <Route path="/join-room" element={
            <PageWrapper><JoinRoomScreen /></PageWrapper>
          } />

          {/* ── Deep-link entry point ────────────────────────────────── */}
          <Route path="/join/:roomCode" element={
            <PageWrapper><JoinRedirect /></PageWrapper>
          } />

        </Routes>
      </AnimatePresence>
    </AppLayout>
  );
}
