import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, RotateCcw, Timer } from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";

// ─── Theme ─────────────────────────────────────────────────────────────────
const C = {
  background:  "#060709",
  panel:       "#0D1130",
  panelBorder: "#2A3166",
  node:        "#7FA8FF",
  gold:        "#FFD36E",
  teal:        "#6EE7C4",
  textPrimary: "#E8ECFB",
  textMuted:   "#9199B5",
  error:       "#FF6B8A",
} as const;

const INF = Infinity;
const N   = 5;
const LABELS = ["A", "B", "C", "D", "E"];

// ─── Graph definition ──────────────────────────────────────────────────────
// TODO: fetch from GET /api/games/floyd-warshall/graph
//       response shape: { n: number, labels: string[], edges: [i,j,w][] }
//
// Adjacency matrix — INF means no direct edge, 0 on diagonal
const INITIAL_DIST: number[][] = [
  //  A    B    C    D    E
  [   0,   3, INF,   7, INF ],  // A
  [   8,   0,   2, INF, INF ],  // B
  [   5, INF,   0,   1,   7 ],  // C
  [   2, INF, INF,   0,   3 ],  // D
  [INF,   1, INF, INF,   0  ],  // E
];

// ─── Floyd-Warshall engine ──────────────────────────────────────────────────

/** Deep-clone a 2-D number array */
const clone2D = (m: number[][]): number[][] => m.map((row) => [...row]);

/**
 * Compute the full sequence of (k, i, j) steps Floyd-Warshall would visit,
 * together with the expected matrix state AFTER each update.
 *
 * TODO: replace with step sequence from backend — each step should carry
 *       { k, i, j, expectedValue } so the server controls the game flow.
 */
interface Step {
  k: number; // intermediate node index
  i: number; // row
  j: number; // column
  newValue: number; // correct value for dist[i][j] at this point
  matrixSnapshot: number[][]; // full matrix state after this step
}

function computeAllSteps(initial: number[][]): Step[] {
  const dist = clone2D(initial);
  const steps: Step[] = [];

  for (let k = 0; k < N; k++) {
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        if (i === j) continue; // diagonal always 0 — skip
        const via = dist[i][k] === INF || dist[k][j] === INF
          ? INF
          : dist[i][k] + dist[k][j];
        if (via < dist[i][j]) {
          dist[i][j] = via;
          steps.push({
            k, i, j,
            newValue: via,
            matrixSnapshot: clone2D(dist),
          });
        }
      }
    }
  }
  return steps;
}

// ─── Cell flash state ──────────────────────────────────────────────────────
type CellFlash = "correct" | "error" | null;

// ─── Helpers ──────────────────────────────────────────────────────────────
const fmt = (v: number): string => (v === INF ? "∞" : String(v));

const formatTime = (s: number): string =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

// ─── Component ─────────────────────────────────────────────────────────────
export default function FloydWarshallGame() {
  // Steps are precomputed once — TODO: swap for server-provided sequence
  const [allSteps]   = useState<Step[]>(() => computeAllSteps(INITIAL_DIST));
  const [matrix,     setMatrix]    = useState<number[][]>(() => clone2D(INITIAL_DIST));
  const [stepIdx,    setStepIdx]   = useState(0);
  const [inputVal,   setInputVal]  = useState("");
  const [cellFlash,  setCellFlash] = useState<CellFlash>(null);
  const [confirmed,  setConfirmed] = useState<Set<string>>(() => new Set());
  const [seconds,    setSeconds]   = useState(0);
  const [running,    setRunning]   = useState(true);
  const [won,        setWon]       = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentStep = allSteps[stepIdx] ?? null;
  const totalSteps  = allSteps.length;

  // ── Timer ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  // ── Focus input whenever active cell changes ───────────────────────────
  useEffect(() => {
    if (!won) inputRef.current?.focus();
  }, [stepIdx, won]);

  // ── Submit handler ─────────────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    if (!currentStep || won) return;

    const parsed = inputVal.trim() === "∞" || inputVal.trim() === "inf"
      ? INF
      : Number(inputVal.trim());

    if (isNaN(parsed)) return; // not a valid number yet

    const correct = parsed === currentStep.newValue;

    if (correct) {
      // Update matrix to the snapshot for this step
      setMatrix(currentStep.matrixSnapshot);
      setConfirmed((prev) => new Set(prev).add(`${currentStep.i}-${currentStep.j}`));
      setCellFlash("correct");
      setTimeout(() => setCellFlash(null), 600);
      setInputVal("");

      const next = stepIdx + 1;
      if (next >= totalSteps) {
        setWon(true);
        setRunning(false);
      } else {
        setStepIdx(next);
      }
    } else {
      // TODO: POST { k, i, j, value: parsed } to /api/games/floyd-warshall/validate
      //       for server-side error detail. For now flash error and let retry.
      setCellFlash("error");
      setTimeout(() => setCellFlash(null), 600);
    }
  }, [currentStep, inputVal, stepIdx, totalSteps, won]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSubmit();
  };

  // ── Reset ──────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setMatrix(clone2D(INITIAL_DIST));
    setStepIdx(0);
    setInputVal("");
    setCellFlash(null);
    setConfirmed(new Set());
    setSeconds(0);
    setRunning(true);
    setWon(false);
  }, []);

  // ─── Cell styling helpers ─────────────────────────────────────────────

  const isKRow = (r: number) => currentStep !== null && r === currentStep.k;
  const isKCol = (c: number) => currentStep !== null && c === currentStep.k;
  const isActive = (r: number, c: number) =>
    currentStep !== null && r === currentStep.i && c === currentStep.j;
  const isConfirmed = (r: number, c: number) => confirmed.has(`${r}-${c}`);

  function cellBg(r: number, c: number): string {
    if (isActive(r, c)) return "transparent"; // gold border cell — handled separately
    if (isConfirmed(r, c)) return "rgba(110,231,196,0.07)";
    if (isKRow(r) || isKCol(c)) return "rgba(127,168,255,0.07)";
    return "transparent";
  }

  function cellBorder(r: number, c: number): string {
    if (isActive(r, c)) {
      if (cellFlash === "correct") return `2px solid ${C.teal}`;
      if (cellFlash === "error")   return `2px solid ${C.error}`;
      return `2px solid ${C.gold}`;
    }
    if (isConfirmed(r, c)) return `1px solid rgba(110,231,196,0.25)`;
    return `1px solid ${C.panelBorder}`;
  }

  function cellTextColor(r: number, c: number): string {
    if (isActive(r, c)) {
      if (cellFlash === "correct") return C.teal;
      if (cellFlash === "error")   return C.error;
      return C.gold;
    }
    if (r === c) return C.textMuted;
    if (isConfirmed(r, c)) return C.teal;
    if (matrix[r][c] === INF) return C.textMuted;
    return C.textPrimary;
  }

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <motion.div
      className="flex flex-col gap-6"
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }}
      initial="hidden"
      animate="visible"
    >

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <motion.div
        variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
        className="flex items-start justify-between gap-4 flex-wrap"
      >
        <div>
          <h1 className="font-sans text-2xl font-bold text-textPrimary">
            Floyd-Warshall Grid
          </h1>
          <p className="mt-1 text-sm text-textMuted">
            Fill each updated cell with the correct shortest-path distance.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 rounded-full border border-panelBorder bg-panel px-3 py-1.5">
            <Timer size={14} className="text-textMuted" aria-hidden="true" />
            <span className="font-mono text-sm tabular-nums text-textPrimary">
              {formatTime(seconds)}
            </span>
          </div>
          <Button
            variant="secondary"
            onClick={handleReset}
            className="!px-3 !py-1.5 text-xs gap-1.5"
          >
            <RotateCcw size={13} aria-hidden="true" />
            Reset
          </Button>
        </div>
      </motion.div>

      {/* ── Intermediate node banner ───────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="rounded-lg border border-panelBorder bg-panel px-4 py-2 flex items-center gap-3">
          <span className="text-sm text-textMuted">Processing intermediate node:</span>
          <span className="font-mono text-lg font-bold text-node">
            {currentStep ? LABELS[currentStep.k] : "—"}
          </span>
        </div>
        {currentStep && (
          <div className="rounded-lg border border-panelBorder bg-panel px-4 py-2 flex items-center gap-2 text-sm text-textMuted">
            <span>Update</span>
            <span className="font-mono text-textPrimary font-semibold">
              dist[{LABELS[currentStep.i]}][{LABELS[currentStep.j]}]
            </span>
            <span>via</span>
            <span className="font-mono text-node font-semibold">
              {LABELS[currentStep.k]}
            </span>
          </div>
        )}
      </div>

      {/* ── Progress bar ──────────────────────────────────────────────────── */}
      <Card className="!p-4 flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-textMuted">Cells completed</span>
            <span className="font-mono text-xs text-textPrimary">
              {stepIdx} / {totalSteps}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-panelBorder overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-node to-teal"
              animate={{ width: `${totalSteps > 0 ? (stepIdx / totalSteps) * 100 : 0}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-textMuted">Score</p>
          <p className="font-mono text-lg font-bold text-gold">{stepIdx * 10}</p>
        </div>
      </Card>

      {/* ── Initial graph edges reminder ──────────────────────────────────── */}
      <details className="group">
        <summary className="cursor-pointer text-xs text-textMuted hover:text-textPrimary transition-colors list-none flex items-center gap-1.5 w-fit">
          <span className="group-open:rotate-90 inline-block transition-transform">▶</span>
          Show initial edge weights
        </summary>
        <div className="mt-2 flex flex-wrap gap-2">
          {INITIAL_DIST.flatMap((row, i) =>
            row.map((w, j) =>
              i !== j && w !== INF ? (
                <span
                  key={`${i}-${j}`}
                  className="rounded-md border border-panelBorder bg-panel px-2 py-1 font-mono text-xs text-textMuted"
                >
                  {LABELS[i]}→{LABELS[j]}: <span className="text-node">{w}</span>
                </span>
              ) : null
            )
          )}
        </div>
      </details>

      {/* ── Matrix grid ───────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <div
          className="inline-block rounded-xl border border-panelBorder overflow-hidden shadow-panel"
          style={{ minWidth: "min-content" }}
          role="grid"
          aria-label="Floyd-Warshall distance matrix"
        >
          <table className="border-collapse" style={{ tableLayout: "fixed" }}>
            {/* Column headers */}
            <thead>
              <tr>
                {/* Top-left corner cell */}
                <th
                  className="font-mono text-xs text-textMuted text-center"
                  style={{
                    width: 48, height: 48,
                    background: C.panel,
                    border: `1px solid ${C.panelBorder}`,
                    padding: 0,
                  }}
                  aria-hidden="true"
                >
                  <span style={{ color: C.textMuted, fontSize: 10 }}>i\j</span>
                </th>
                {LABELS.map((lbl, j) => (
                  <th
                    key={j}
                    style={{
                      width: 56, height: 48,
                      background: currentStep && j === currentStep.k
                        ? "rgba(127,168,255,0.12)"
                        : C.panel,
                      border: `1px solid ${C.panelBorder}`,
                      padding: 0,
                      transition: "background 0.3s",
                    }}
                    scope="col"
                  >
                    <span
                      className="font-mono text-sm font-bold"
                      style={{
                        color: currentStep && j === currentStep.k ? C.node : C.textMuted,
                        display: "block",
                        textAlign: "center",
                      }}
                    >
                      {lbl}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {matrix.map((row, i) => (
                <tr key={i}>
                  {/* Row header */}
                  <th
                    scope="row"
                    style={{
                      width: 48, height: 52,
                      background: currentStep && i === currentStep.k
                        ? "rgba(127,168,255,0.12)"
                        : C.panel,
                      border: `1px solid ${C.panelBorder}`,
                      padding: 0,
                      transition: "background 0.3s",
                    }}
                  >
                    <span
                      className="font-mono text-sm font-bold"
                      style={{
                        color: currentStep && i === currentStep.k ? C.node : C.textMuted,
                        display: "block",
                        textAlign: "center",
                      }}
                    >
                      {LABELS[i]}
                    </span>
                  </th>

                  {/* Data cells */}
                  {row.map((val, j) => {
                    const active = isActive(i, j);

                    return (
                      <td
                        key={j}
                        role="gridcell"
                        aria-label={`${LABELS[i]} to ${LABELS[j]}: ${fmt(val)}`}
                        style={{
                          width: 56, height: 52,
                          background: cellBg(i, j),
                          border: cellBorder(i, j),
                          padding: 0,
                          position: "relative",
                          transition: "background 0.25s, border-color 0.2s",
                          boxShadow: active
                            ? cellFlash === "correct"
                              ? `inset 0 0 10px rgba(110,231,196,0.2)`
                              : cellFlash === "error"
                              ? `inset 0 0 10px rgba(255,107,138,0.2)`
                              : `inset 0 0 12px rgba(255,211,110,0.15)`
                            : "none",
                        }}
                      >
                        {active ? (
                          /* Editable active cell */
                          <motion.div
                            animate={
                              cellFlash === "correct"
                                ? { backgroundColor: ["rgba(110,231,196,0.2)", "transparent"] }
                                : cellFlash === "error"
                                ? { backgroundColor: ["rgba(255,107,138,0.2)", "transparent"] }
                                : {}
                            }
                            transition={{ duration: 0.5 }}
                            style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            <input
                              ref={inputRef}
                              type="text"
                              inputMode="numeric"
                              value={inputVal}
                              onChange={(e) => setInputVal(e.target.value)}
                              onKeyDown={handleKeyDown}
                              aria-label={`Enter value for ${LABELS[i]} to ${LABELS[j]}`}
                              style={{
                                width: "100%",
                                height: "100%",
                                background: "transparent",
                                border: "none",
                                outline: "none",
                                textAlign: "center",
                                fontFamily: "JetBrains Mono, monospace",
                                fontSize: "14px",
                                fontWeight: 700,
                                color: cellFlash === "correct" ? C.teal
                                     : cellFlash === "error"   ? C.error
                                     : C.gold,
                                caretColor: C.gold,
                                padding: 0,
                              }}
                              placeholder="?"
                              autoComplete="off"
                              spellCheck={false}
                            />
                          </motion.div>
                        ) : (
                          /* Display-only cell */
                          <span
                            style={{
                              width: "100%",
                              height: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontFamily: "JetBrains Mono, monospace",
                              fontSize: "13px",
                              fontWeight: i === j ? 400 : 600,
                              color: cellTextColor(i, j),
                            }}
                            aria-hidden={active}
                          >
                            {fmt(val)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Submit button (also keyboard-accessible) ──────────────────────── */}
      {!won && currentStep && (
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={handleSubmit} className="!px-4 !py-2 text-sm">
            Confirm value
          </Button>
          <p className="text-xs text-textMuted font-mono">
            or press <kbd
              className="rounded border border-panelBorder bg-panel px-1.5 py-0.5 text-textPrimary"
              style={{ fontFamily: "inherit" }}
            >Enter</kbd>
          </p>
        </div>
      )}

      {/* ── Legend ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4 text-xs text-textMuted">
        {[
          { color: C.gold,        label: "Active cell (your input)" },
          { color: C.teal,        label: "Confirmed correct"        },
          { color: C.node,        label: "Active k row/column"      },
          { color: C.textMuted,   label: "No direct edge (∞)"       },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded-sm"
              style={{ background: color, opacity: 0.85 }}
            />
            {label}
          </div>
        ))}
      </div>

      {/* ── Success overlay ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {won && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{    opacity: 0, scale: 0.92, y: 20  }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(6,8,24,0.75)", backdropFilter: "blur(6px)" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="fw-success-title"
          >
            <Card
              className="w-full max-w-sm text-center flex flex-col items-center gap-5"
              style={{
                border: `2px solid ${C.teal}`,
                boxShadow: `0 0 0 2px rgba(110,231,196,0.25), 0 0 40px 10px rgba(110,231,196,0.15)`,
              }}
            >
              <CheckCircle2 size={48} className="text-teal" aria-hidden="true" />
              <div className="flex flex-col gap-1">
                <h2
                  id="fw-success-title"
                  className="font-sans text-xl font-bold text-textPrimary"
                >
                  All Shortest Paths Computed!
                </h2>
                <p className="text-sm text-textMuted">
                  You filled all{" "}
                  <span className="font-mono font-semibold text-textPrimary">
                    {totalSteps}
                  </span>{" "}
                  updated cells correctly.
                </p>
                <p className="mt-1 text-sm text-textMuted">
                  Time:{" "}
                  <span className="font-mono font-semibold text-textPrimary">
                    {formatTime(seconds)}
                  </span>
                  {"  ·  "}Score:{" "}
                  <span className="font-mono font-bold text-gold">
                    {totalSteps * 10}
                  </span>
                </p>
              </div>

              {/* TODO: POST { steps: totalSteps, seconds } to /api/games/floyd-warshall/submit */}

              <div className="flex gap-3">
                <Button variant="primary" onClick={handleReset}>
                  Play again
                </Button>
                <Button variant="secondary" onClick={handleReset}>
                  {/* TODO: navigate to next challenge */}
                  Next challenge
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
