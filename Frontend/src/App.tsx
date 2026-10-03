import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import AppLayout from "./components/AppLayout";

// Pages
import Dashboard            from "./pages/Dashboard";
import Leaderboard          from "./pages/Leaderboard";
import DijkstraGame         from "./pages/games/DijkstraGame";
import BSTGame              from "./pages/games/BSTGame";
import FloydWarshallGame    from "./pages/games/FloydWarshallGame";
import MissingOperatorGame  from "./pages/games/MissingOperatorGame";
import MathsQuestionsGame   from "./pages/games/MathsQuestionsGame";

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
};

const pageTransition = { duration: 0.25, ease: "easeInOut" as const };

/** Animated wrapper applied to each route's element */
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

export default function App() {
  const location = useLocation();

  return (
    <AppLayout>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={
            <PageWrapper><Dashboard /></PageWrapper>
          } />
          <Route path="/leaderboard" element={
            <PageWrapper><Leaderboard /></PageWrapper>
          } />
          <Route path="/game/dijkstra" element={
            <PageWrapper><DijkstraGame /></PageWrapper>
          } />
          <Route path="/game/bst" element={
            <PageWrapper><BSTGame /></PageWrapper>
          } />
          <Route path="/game/floyd-warshall" element={
            <PageWrapper><FloydWarshallGame /></PageWrapper>
          } />
          <Route path="/game/missing-operator" element={
            <PageWrapper><MissingOperatorGame /></PageWrapper>
          } />
          <Route path="/game/maths-questions" element={
            <PageWrapper><MathsQuestionsGame /></PageWrapper>
          } />
        </Routes>
      </AnimatePresence>
    </AppLayout>
  );
}
