/**
 * MathsQuestionsBoard.tsx
 *
 * Core gameplay UI for Interesting Maths Questions.
 * Renders the progress bar, quiz card with A/B/C/D options,
 * and the results overlay.
 *
 * What is NOT here (belongs in the page wrapper):
 *  - Page heading / description
 */

import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Trophy } from "lucide-react";
import Card from "../ui/Card";
import Button from "../ui/Button";

// ─── Theme ─────────────────────────────────────────────────────────────────────
const C = {
  background:  "#060709",
  panel:       "#0D1130",
  panelBorder: "#2A3166",
  gold:        "#FFD36E",
  teal:        "#6EE7C4",
  textPrimary: "#E8ECFB",
  textMuted:   "#9199B5",
  error:       "#FF6B8A",
} as const;

// ─── Question bank ──────────────────────────────────────────────────────────────
interface Question { id: string; question: string; options: string[]; correctIndex: number; }

const QUESTIONS: Question[] = [
  { id: "q01", question: "What is the time complexity of binary search on a sorted array of n elements?", options: ["O(n)", "O(log n)", "O(n²)", "O(1)"], correctIndex: 1 },
  { id: "q02", question: "Which data structure uses LIFO (Last In, First Out) order?", options: ["Queue", "Linked List", "Stack", "Heap"], correctIndex: 2 },
  { id: "q03", question: "What is the sum of the first 100 natural numbers?", options: ["4 950", "5 000", "5 050", "10 100"], correctIndex: 2 },
  { id: "q04", question: "In Dijkstra's algorithm, which node is always processed next?", options: ["The node with the most neighbors", "The unvisited node with the smallest tentative distance", "The last visited node", "A random unvisited node"], correctIndex: 1 },
  { id: "q05", question: "What is 2¹⁰ (2 to the power of 10)?", options: ["512", "1 000", "1 024", "2 048"], correctIndex: 2 },
  { id: "q06", question: "How many edges does a complete graph with 5 nodes (K₅) have?", options: ["5", "8", "10", "20"], correctIndex: 2 },
  { id: "q07", question: "Which sorting algorithm has an average-case time complexity of O(n log n)?", options: ["Bubble sort", "Insertion sort", "Merge sort", "Selection sort"], correctIndex: 2 },
  { id: "q08", question: "In a min-heap, which element is always at the root?", options: ["The largest element", "The most recently inserted element", "The median element", "The smallest element"], correctIndex: 3 },
  { id: "q09", question: "What is the result of: log₂(64)?", options: ["4", "5", "6", "8"], correctIndex: 2 },
  { id: "q10", question: "The Floyd-Warshall algorithm finds shortest paths between:", options: ["A single source and all other nodes", "Two specific nodes only", "All pairs of nodes", "Adjacent nodes only"], correctIndex: 2 },
];

const TOTAL = QUESTIONS.length;

type OptionState = "idle" | "correct" | "wrong" | "reveal";

// ─── Props ─────────────────────────────────────────────────────────────────────
export interface MathsQuestionsBoardProps {
  onComplete?: (score: number, correct: number, wrong: number) => void;
  onReset?:    () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function MathsQuestionsBoard({ onComplete, onReset }: MathsQuestionsBoardProps) {
  const [qIdx,    setQIdx]    = useState(0);
  const [score,   setScore]   = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong,   setWrong]   = useState(0);
  const [done,    setDone]    = useState(false);
  const [picked,  setPicked]  = useState<number | null>(null);
  const [locked,  setLocked]  = useState(false);
  const [showQ,   setShowQ]   = useState(true);

  const question = QUESTIONS[qIdx];

  const handlePick = useCallback(
    (optIdx: number) => {
      if (locked || done) return;
      setPicked(optIdx);
      setLocked(true);
      const isCorrect = optIdx === question.correctIndex;
      const newScore   = isCorrect ? score + 10 : score;
      const newCorrect = isCorrect ? correct + 1 : correct;
      const newWrong   = !isCorrect ? wrong + 1 : wrong;
      if (isCorrect) { setScore(newScore); setCorrect(newCorrect); }
      else           { setWrong(newWrong); }

      setTimeout(() => {
        setShowQ(false);
        setTimeout(() => {
          if (qIdx + 1 >= TOTAL) {
            setDone(true);
            onComplete?.(newScore, newCorrect, newWrong);
          } else {
            setQIdx((i) => i + 1);
            setPicked(null);
            setLocked(false);
          }
          setShowQ(true);
        }, 280);
      }, 1500);
    },
    [locked, done, question, qIdx, score, correct, wrong, onComplete]
  );

  const handleReset = useCallback(() => {
    setQIdx(0);
    setScore(0);
    setCorrect(0);
    setWrong(0);
    setDone(false);
    setPicked(null);
    setLocked(false);
    setShowQ(true);
    onReset?.();
  }, [onReset]);

  // ── Option visual helpers ────────────────────────────────────────────────
  function optionState(optIdx: number): OptionState {
    if (picked === null) return "idle";
    if (optIdx === question.correctIndex) return picked === optIdx ? "correct" : "reveal";
    return optIdx === picked ? "wrong" : "idle";
  }

  function optionBorder(state: OptionState): string {
    switch (state) {
      case "correct": case "reveal": return `2px solid ${C.teal}`;
      case "wrong":                  return `2px solid ${C.error}`;
      default:                       return `1.5px solid ${C.panelBorder}`;
    }
  }

  function optionBg(state: OptionState): string {
    switch (state) {
      case "correct": return "rgba(110,231,196,0.10)";
      case "reveal":  return "rgba(110,231,196,0.07)";
      case "wrong":   return "rgba(255,107,138,0.10)";
      default:        return C.panel;
    }
  }

  function optionTextColor(state: OptionState): string {
    switch (state) {
      case "correct": case "reveal": return C.teal;
      case "wrong":                  return C.error;
      default:                       return C.textPrimary;
    }
  }

  function optionGlow(state: OptionState): string {
    switch (state) {
      case "correct": case "reveal": return "0 0 0 2px rgba(110,231,196,0.2), 0 0 12px 3px rgba(110,231,196,0.15)";
      case "wrong":                  return "0 0 0 2px rgba(255,107,138,0.2), 0 0 10px 3px rgba(255,107,138,0.12)";
      default:                       return "none";
    }
  }

  const progressPct = Math.round((qIdx / TOTAL) * 100);

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      {/* Progress bar + score */}
      <div className="w-full max-w-xl flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-textMuted">Progress</span>
            <span className="font-mono text-xs text-textMuted">{qIdx} / {TOTAL}</span>
          </div>
          <div
            className="h-2 w-full rounded-full overflow-hidden"
            style={{ background: C.panelBorder }}
            role="progressbar"
            aria-valuenow={qIdx}
            aria-valuemin={0}
            aria-valuemax={TOTAL}
            aria-label="Quiz progress"
          >
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(to right, ${C.node}, ${C.gold})` }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-textMuted">Score</p>
          <p className="font-mono text-2xl font-bold text-gold tabular-nums">{score}</p>
        </div>
      </div>

      {/* Quiz card */}
      <div className="w-full max-w-xl">
        <AnimatePresence mode="wait">
          {showQ && !done && (
            <motion.div
              key={question.id}
              initial={{ opacity: 0, y: 14  }}
              animate={{ opacity: 1, y: 0   }}
              exit={{    opacity: 0, y: -14 }}
              transition={{ duration: 0.26, ease: "easeInOut" }}
            >
              <Card className="flex flex-col gap-6">
                {/* Question counter + tally */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-textMuted">
                    Question <span className="font-semibold text-textPrimary">{qIdx + 1}</span> of <span className="font-semibold text-textPrimary">{TOTAL}</span>
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-xs font-mono text-teal">
                      <Check size={12} aria-hidden="true" />{correct}
                    </span>
                    <span className="flex items-center gap-1 text-xs font-mono" style={{ color: C.error }}>
                      <X size={12} aria-hidden="true" />{wrong}
                    </span>
                  </div>
                </div>

                {/* Question text */}
                <p className="text-xl font-sans font-semibold text-textPrimary leading-snug">
                  {question.question}
                </p>

                {/* Options */}
                <div className="flex flex-col gap-3" role="group" aria-label="Answer options">
                  {question.options.map((opt, i) => {
                    const state = optionState(i);
                    return (
                      <motion.button
                        key={i}
                        whileHover={!locked ? { scale: 1.015, borderColor: C.gold } : undefined}
                        whileTap={!locked ? { scale: 0.985 } : undefined}
                        transition={{ type: "spring", stiffness: 380, damping: 22 }}
                        onClick={() => handlePick(i)}
                        disabled={locked}
                        aria-pressed={picked === i}
                        aria-label={`Option ${i + 1}: ${opt}${
                          state === "correct" ? " — Correct!" :
                          state === "reveal"  ? " — Correct answer" :
                          state === "wrong"   ? " — Incorrect" : ""
                        }`}
                        style={{
                          width: "100%", padding: "12px 16px", borderRadius: 10,
                          border: optionBorder(state),
                          background: optionBg(state),
                          boxShadow: optionGlow(state),
                          cursor: locked ? "default" : "pointer",
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          gap: 12, textAlign: "left",
                          transition: "border-color 0.2s, background 0.25s, box-shadow 0.25s",
                          outline: "none",
                        }}
                        onFocus={(e) => { if (!locked) (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 2px ${C.gold}60`; }}
                        onBlur={(e)  => { if (state === "idle") (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
                      >
                        <span
                          className="shrink-0 flex items-center justify-center rounded-md font-mono text-xs font-bold"
                          style={{
                            width: 28, height: 28,
                            background: state === "idle" ? C.panelBorder : "transparent",
                            color: optionTextColor(state),
                            border: state !== "idle" ? `1px solid ${optionTextColor(state)}` : "none",
                            transition: "color 0.2s, background 0.2s",
                          }}
                          aria-hidden="true"
                        >
                          {["A", "B", "C", "D"][i]}
                        </span>
                        <span
                          className="flex-1 font-sans text-sm font-medium leading-snug"
                          style={{ color: optionTextColor(state), transition: "color 0.2s" }}
                        >
                          {opt}
                        </span>
                        <AnimatePresence>
                          {(state === "correct" || state === "reveal") && (
                            <motion.span
                              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                              transition={{ type: "spring", stiffness: 400, damping: 18 }}
                              aria-hidden="true"
                            >
                              <Check size={18} style={{ color: C.teal }} />
                            </motion.span>
                          )}
                          {state === "wrong" && (
                            <motion.span
                              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                              transition={{ type: "spring", stiffness: 400, damping: 18 }}
                              aria-hidden="true"
                            >
                              <X size={18} style={{ color: C.error }} />
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    );
                  })}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Results overlay */}
      <AnimatePresence>
        {done && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9,  y: 24 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{    opacity: 0, scale: 0.9,  y: 24  }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(6,8,24,0.82)", backdropFilter: "blur(6px)" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mq-results-title"
          >
            <Card
              className="w-full max-w-sm flex flex-col items-center gap-6 text-center"
              style={{ border: `2px solid ${C.gold}`, boxShadow: "0 0 0 2px rgba(255,211,110,0.18), 0 0 40px 10px rgba(255,211,110,0.10)" }}
            >
              <Trophy size={48} style={{ color: C.gold }} aria-hidden="true" />
              <div className="flex flex-col gap-1">
                <h2 id="mq-results-title" className="font-sans text-2xl font-bold text-textPrimary">
                  Quiz Complete!
                </h2>
                <p className="font-mono text-5xl font-bold text-gold mt-1">
                  {score}<span className="text-2xl text-textMuted font-normal"> / {TOTAL * 10}</span>
                </p>
                <p className="text-sm text-textMuted">{correct} of {TOTAL} questions correct</p>
              </div>

              {/* Breakdown */}
              <div className="w-full flex gap-3">
                {[
                  { label: "Correct",   value: correct, color: C.teal,  Icon: Check, bg: "rgba(110,231,196,0.08)", border: "rgba(110,231,196,0.2)" },
                  { label: "Incorrect", value: wrong,   color: C.error, Icon: X,    bg: "rgba(255,107,138,0.08)", border: "rgba(255,107,138,0.2)" },
                  { label: "Accuracy",  value: `${Math.round((correct / TOTAL) * 100)}%`, color: C.gold, Icon: Trophy, bg: "rgba(255,211,110,0.08)", border: "rgba(255,211,110,0.2)" },
                ].map(({ label, value, color, Icon, bg, border }) => (
                  <div
                    key={label}
                    className="flex-1 rounded-lg py-3 flex flex-col items-center gap-1"
                    style={{ background: bg, border: `1px solid ${border}` }}
                  >
                    <Icon size={16} style={{ color }} aria-hidden="true" />
                    <span className="font-mono text-xl font-bold" style={{ color }}>{value}</span>
                    <span className="text-xs text-textMuted">{label}</span>
                  </div>
                ))}
              </div>

              <Button variant="primary" onClick={handleReset}>Play again</Button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
