import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import AppLayout from "./components/AppLayout";

// ── Core pages ────────────────────────────────────────────────────────────────
import Dashboard            from "./pages/Dashboard";
import Leaderboard          from "./pages/Leaderboard";

// ── Shared game-flow pages ────────────────────────────────────────────────────
import GameModeSelect       from "./pages/GameModeSelect";
import FriendModeSelect     from "./pages/FriendModeSelect";

// ── Multiplayer lobby pages ───────────────────────────────────────────────────
import RandomQueue          from "./pages/RandomQueue";
import InviteScreen         from "./pages/InviteScreen";
import JoinRoomScreen       from "./pages/JoinRoomScreen";
import JoinRedirect         from "./pages/JoinRedirect";

// ── Legacy direct-play pages (kept until solo wrapper is built) ───────────────
import DijkstraGame         from "./pages/games/DijkstraGame";
import BSTGame              from "./pages/games/BSTGame";
import FloydWarshallGame    from "./pages/games/FloydWarshallGame";
import MissingOperatorGame  from "./pages/games/MissingOperatorGame";
import MathsQuestionsGame   from "./pages/games/MathsQuestionsGame";

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
          {/* Step 2: friends sub-mode chooser */}
          <Route path="/game/:gameType/friends" element={
            <PageWrapper><FriendModeSelect /></PageWrapper>
          } />

          {/* ── Multiplayer lobby ────────────────────────────────────── */}
          {/* Random matchmaking queue */}
          <Route path="/game/:gameType/queue" element={
            <PageWrapper><RandomQueue /></PageWrapper>
          } />
          {/* Host: create a room, share code / link */}
          <Route path="/game/:gameType/invite" element={
            <PageWrapper><InviteScreen /></PageWrapper>
          } />
          {/* Guest: enter a room code (gameType context known) */}
          <Route path="/game/:gameType/join" element={
            <PageWrapper><JoinRoomScreen /></PageWrapper>
          } />
          {/* Guest: enter a room code (no gameType context — from deep-link redirect) */}
          <Route path="/join-room" element={
            <PageWrapper><JoinRoomScreen /></PageWrapper>
          } />

          {/* ── Deep-link entry point ────────────────────────────────── */}
          {/* /join/:roomCode — shared invite links land here first      */}
          <Route path="/join/:roomCode" element={
            <PageWrapper><JoinRedirect /></PageWrapper>
          } />

          {/* ── Legacy direct-play routes ────────────────────────────── */}
          {/* Kept until the solo wrapper page is built.                 */}
          {/* TODO: replace with /game/:gameType/solo once that exists.  */}
          <Route path="/game/dijkstra/play" element={
            <PageWrapper><DijkstraGame /></PageWrapper>
          } />
          <Route path="/game/bst/play" element={
            <PageWrapper><BSTGame /></PageWrapper>
          } />
          <Route path="/game/floyd-warshall/play" element={
            <PageWrapper><FloydWarshallGame /></PageWrapper>
          } />
          <Route path="/game/missing-operator/play" element={
            <PageWrapper><MissingOperatorGame /></PageWrapper>
          } />
          <Route path="/game/maths-questions/play" element={
            <PageWrapper><MathsQuestionsGame /></PageWrapper>
          } />

        </Routes>
      </AnimatePresence>
    </AppLayout>
  );
}
