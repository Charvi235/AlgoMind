import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Clock, RotateCcw } from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";


// ─── Theme ─── ───────────────────────────────────────────────────────────────── //


const C = {
  background:  "#060709",
  panel:       "#0D1130",
  panelBorder: "#2A3166",
  gold:        "#FFD36E",
  teal:        "#6EE7C4",
  textPrimary: "#E8ECFB",
  textMuted:   "#9199B5",
  error:       "#FF6B8A",
  amber:       "#FFA040",
} as const;

// ─── Operators ────────────────────────────────────────────────────────────────
type Operator = "+" | "−" | "×" | "÷";

const OPERATORS: Operator[] = ["+", "−", "×", "÷"];

// Maps display symbol → JS evaluable operator (used when wiring backend validation)
// TODO: use OP_MAP when sending operator to /api/games/missing-operator/answer
const OP_MAP : Record<Operator, string> = {
  "+": "+",
  "−": "-",
  "×": "*",
  "÷": "/",
};

// ─── Question bank ────────────────────────────────────────────────────────────
// TODO: replace with GET /api/games/missing-operator/questions
//       Response shape: { id: string, a: number, b: number, result: number, operator: Operator }[]

interface Question {
  id:       string;
  a:        number;
  b:        number;
  result:   number;
  operator: Operator;
}

const QUESTION_BANK: Question[] = [
  { id: "q1",  a:  6, b:  2, result: 12,   operator: "×" },
  { id: "q2",  a: 15, b:  3, result:  5,   operator: "÷" },
  { id: "q3",  a:  8, b:  4, result: 12,   operator: "+" },
  { id: "q4",  a: 20, b:  7, result: 13,   operator: "−" },
  { id: "q5",  a:  9, b:  9, result: 81,   operator: "×" },
  { id: "q6",  a: 36, b:  6, result:  6,   operator: "÷" },
  { id: "q7",  a: 14, b:  8, result: 22,   operator: "+" },
  { id: "q8",  a: 25, b: 10, result: 15,   operator: "−" },
  { id: "q9",  a:  7, b:  6, result: 42,   operator: "×" },
  { id: "q10", a: 48, b:  8, result:  6,   operator: "÷" },
  { id: "q11", a: 33, b: 17, result: 50,   operator: "+" },
  { id: "q12", a: 50, b: 23, result: 27,   operator: "−" },
];

const COUNTDOWN = 30;

// ─── Shuffle helper ───────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Placeholder state ────────────────────────────────────────────────────────
type PlaceholderState = "idle" | "correct" | "error";

// ─── Float-up score particle ──────────────────────────────────────────────────
interface ScoreParticle {
  id:    number;
  value: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function MissingOperatorGame() {
  const navigate = useNavigate();

  // ── Question state ──────────────────────────────────────────────────────
  const [deck,       setDeck]       = useState<Question[]>(() => shuffle(QUESTION_BANK));
  const [qIdx,       setQIdx]       = useState(0);
  const [showQ,      setShowQ]      = useState(true);   // controls fade transition

  // ── Game state ──────────────────────────────────────────────────────────
  const [score,      setScore]      = useState(0);
  const [timeLeft,   setTimeLeft]   = useState(COUNTDOWN);
  const [gameOver,   setGameOver]   = useState(false);

  // ── Feedback state ──────────────────────────────────────────────────────
  const [phState,    setPhState]    = useState<PlaceholderState>("idle");
  const [revealedOp, setRevealedOp] = useState<Operator | null>(null);
  const [particles,  setParticles]  = useState<ScoreParticle[]>([]);
  const particleId                  = useRef(0);

  const currentQ = deck[qIdx % deck.length];

  // ── Timer ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameOver) return;
    if (timeLeft <= 0) { setGameOver(true); return; }
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timeLeft, gameOver]);

  // ── Operator pick ────────────────────────────────────────────────────────
  const handlePick = useCallback(
    (op: Operator) => {
      if (phState !== "idle" || gameOver) return;

      const correct = op === currentQ.operator;

      // TODO: POST { questionId: currentQ.id, answer: op } to
      //       /api/games/missing-operator/answer for server validation.
      //       For now, validate locally.

      if (correct) {
        setPhState("correct");
        setRevealedOp(op);

        // Float-up particle
        const pid = ++particleId.current;
        setParticles((p) => [...p, { id: pid, value: "+10" }]);
        setTimeout(
          () => setParticles((p) => p.filter((x) => x.id !== pid)),
          900
        );

        setScore((s) => s + 10);

        // Brief pause to show teal state, then transition to next question
        setTimeout(() => {
          setShowQ(false);
          setTimeout(() => {
            setQIdx((i) => i + 1);
            setPhState("idle");
            setRevealedOp(null);
            setShowQ(true);
          }, 250); // wait for fade-out, then swap question, fade back in
        }, 700);
      } else {
        setPhState("error");
        setTimeout(() => setPhState("idle"), 600);
      }
    },
    [phState, gameOver, currentQ]
  );

  // ── Reset ────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setDeck(shuffle(QUESTION_BANK));
    setQIdx(0);
    setScore(0);
    setTimeLeft(COUNTDOWN);
    setGameOver(false);
    setPhState("idle");
    setRevealedOp(null);
    setParticles([]);
    setShowQ(true);
  }, []);

  // ── Derived timer visuals ────────────────────────────────────────────────
  const timerColor =
    timeLeft <= 5  ? C.error :
    timeLeft <= 10 ? C.amber :
                     C.textPrimary;

  const timerGlow =
    timeLeft <= 5
      ? `0 0 12px 3px rgba(255,107,138,0.5)`
      : timeLeft <= 10
      ? `0 0 10px 2px rgba(255,160,64,0.4)`
      : "none";

  // ── Placeholder glow & color ─────────────────────────────────────────────
  const phColor =
    phState === "correct" ? C.teal :
    phState === "error"   ? C.error :
                            C.gold;

  const phShadow =
    phState === "correct"
      ? `0 0 0 2px rgba(110,231,196,0.4), 0 0 20px 6px rgba(110,231,196,0.3)`
      : phState === "error"
      ? `0 0 0 2px rgba(255,107,138,0.4), 0 0 16px 4px rgba(255,107,138,0.25)`
      : `0 0 0 2px rgba(255,211,110,0.35), 0 0 16px 5px rgba(255,211,110,0.25)`;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <motion.div
      className="flex flex-col items-center gap-8 py-4"
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
      initial="hidden"
      animate="visible"
    >
      {/* ── Header row: timer + score ────────────────────────────────────── */}
      <motion.div
        variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
        className="w-full max-w-lg flex items-center justify-between gap-4"
      >

        {/* Countdown */}
        <div className="flex items-center gap-2">
          <Clock
            size={18}
            style={{ color: timerColor, transition: "color 0.3s" }}
            aria-hidden="true"
          />
          <motion.span
            animate={{ scale: timeLeft <= 5 ? [1, 1.15, 1] : 1 }}
            transition={timeLeft <= 5 ? { repeat: Infinity, duration: 0.8 } : {}}
            className="font-mono text-4xl font-bold tabular-nums"
            style={{
              color:      timerColor,
              textShadow: timerGlow,
              transition: "color 0.3s, text-shadow 0.3s",
              minWidth: "3ch",
              display: "inline-block",
              textAlign: "right",
            }}
            aria-live="polite"
            aria-label={`${timeLeft} seconds remaining`}
          >
            {String(timeLeft).padStart(2, "0")}
          </motion.span>
        </div>

        {/* Score */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-textMuted">Score</span>
          <span className="font-mono text-3xl font-bold text-gold tabular-nums">
            {score}
          </span>
        </div>

        {/* Reset */}
        <Button
          variant="secondary"
          onClick={handleReset}
          className="!px-3 !py-1.5 text-xs gap-1.5 shrink-0"
        >
          <RotateCcw size={13} aria-hidden="true" />
          Reset
        </Button>
      </motion.div>

      {/* ── Equation card ─────────────────────────────────────────────────── */}
      <motion.div
        variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
        className="w-full max-w-lg relative"
      >
        {/* Score particles */}
        <AnimatePresence>
          {particles.map((p) => (
            <motion.span
              key={p.id}
              initial={{ opacity: 1, y: 0,   scale: 1   }}
              animate={{ opacity: 0, y: -48, scale: 1.2 }}
              exit={{    opacity: 0              }}
              transition={{ duration: 0.85, ease: "easeOut" }}
              className="pointer-events-none absolute right-6 top-4 font-mono text-lg font-bold text-teal z-10 select-none"
              aria-hidden="true"
            >
              {p.value}
            </motion.span>
          ))}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {showQ && (
            <motion.div
              key={currentQ.id}
              initial={{ opacity: 0, y: 12  }}
              animate={{ opacity: 1, y: 0   }}
              exit={{    opacity: 0, y: -12 }}
              transition={{ duration: 0.22, ease: "easeInOut" }}
            >
              <Card className="flex flex-col items-center gap-8 !py-10">

                {/* Equation */}
                <div
                  className="flex items-center gap-4 select-none"
                  aria-label={`Equation: ${currentQ.a} [?] ${currentQ.b} = ${currentQ.result}`}
                >
                  {/* Left operand */}
                  <span className="font-mono text-5xl font-bold text-textPrimary">
                    {currentQ.a}
                  </span>

                  {/* Operator placeholder */}
                  <motion.div
                    animate={
                      phState === "error"
                        ? { x: [-4, 4, -4, 4, 0] }
                        : { x: 0 }
                    }
                    transition={{ duration: 0.3 }}
                    className="relative flex items-center justify-center"
                    style={{
                      width: 56, height: 56,
                      borderRadius: 12,
                      border: `2px solid ${phColor}`,
                      boxShadow: phShadow,
                      background: `rgba(${
                        phState === "correct" ? "110,231,196" :
                        phState === "error"   ? "255,107,138" :
                                               "255,211,110"
                      }, 0.07)`,
                      transition: "border-color 0.2s, box-shadow 0.2s, background 0.2s",
                    }}
                    aria-hidden="true"
                  >
                    <AnimatePresence mode="wait">
                      {revealedOp && phState === "correct" ? (
                        <motion.span
                          key="revealed"
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1,   opacity: 1 }}
                          exit={{    scale: 0.5, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 400, damping: 18 }}
                          className="font-mono text-3xl font-bold"
                          style={{ color: C.teal }}
                        >
                          {revealedOp}
                        </motion.span>
                      ) : (
                        <motion.span
                          key="placeholder"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{    opacity: 0 }}
                          className="font-mono text-xl font-bold select-none"
                          style={{ color: phColor }}
                        >
                          ?
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  {/* Right operand */}
                  <span className="font-mono text-5xl font-bold text-textPrimary">
                    {currentQ.b}
                  </span>

                  {/* Equals */}
                  <span className="font-mono text-4xl font-semibold text-textMuted">
                    =
                  </span>

                  {/* Result */}
                  <span className="font-mono text-5xl font-bold text-gold">
                    {currentQ.result}
                  </span>
                </div>

                {/* Operator buttons */}
                <div
                  className="flex flex-wrap justify-center gap-3"
                  role="group"
                  aria-label="Choose the missing operator"
                >
                  {OPERATORS.map((op) => (
                    <motion.button
                      key={op}
                      whileHover={phState === "idle" ? { scale: 1.08, borderColor: C.gold } : undefined}
                      whileTap={phState  === "idle" ? { scale: 0.93 } : undefined}
                      transition={{ type: "spring", stiffness: 400, damping: 18 }}
                      onClick={() => handlePick(op)}
                      disabled={phState !== "idle" || gameOver}
                      aria-label={`Operator ${op}`}
                      style={{
                        width: 60, height: 60,
                        borderRadius: 12,
                        border: `1.5px solid ${C.panelBorder}`,
                        background: C.panel,
                        fontFamily: "JetBrains Mono, monospace",
                        fontSize: "1.75rem",
                        fontWeight: 700,
                        color: C.textPrimary,
                        cursor: phState === "idle" && !gameOver ? "pointer" : "not-allowed",
                        opacity: phState !== "idle" || gameOver ? 0.4 : 1,
                        transition: "border-color 0.15s, box-shadow 0.15s, opacity 0.2s",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        outline: "none",
                      }}
                      onFocus={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.boxShadow =
                          `0 0 0 2px ${C.gold}60`;
                      }}
                      onBlur={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                      }}
                    >
                      {op}
                    </motion.button>
                  ))}
                </div>

              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Game over overlay ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {gameOver && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9,  y: 24 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{    opacity: 0, scale: 0.9,  y: 24  }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(6,8,24,0.8)", backdropFilter: "blur(6px)" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mo-gameover-title"
          >
            <Card
              className="w-full max-w-sm text-center flex flex-col items-center gap-6"
              style={{
                border: `2px solid ${C.gold}`,
                boxShadow: `0 0 0 2px rgba(255,211,110,0.2), 0 0 40px 10px rgba(255,211,110,0.12)`,
              }}
            >
              <CheckCircle2 size={44} style={{ color: C.teal }} aria-hidden="true" />

              <div className="flex flex-col gap-2">
                <h2
                  id="mo-gameover-title"
                  className="font-sans text-2xl font-bold text-textPrimary"
                >
                  Time's Up!
                </h2>
                <p className="text-textMuted text-sm">
                  Final score
                </p>
                <p className="font-mono text-5xl font-bold text-gold">
                  {score}
                </p>
                <p className="text-xs text-textMuted mt-1">
                  {Math.round(score / 10)} question{score !== 10 ? "s" : ""} answered correctly
                </p>
              </div>

              {/* TODO: POST { score, questionsAnswered: Math.round(score/10) }
                        to /api/games/missing-operator/submit */}

              <div className="flex gap-3 flex-wrap justify-center">
                <Button variant="primary" onClick={handleReset}>
                  Play again
                </Button>
                <Button variant="secondary" onClick={() => navigate("/")}>
                  Back to dashboard
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
