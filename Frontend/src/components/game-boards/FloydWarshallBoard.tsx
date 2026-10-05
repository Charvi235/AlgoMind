/**
 * FloydWarshallBoard.tsx
 *
 * Core gameplay UI for Floyd-Warshall Grid.
 * Renders the intermediate-node banner, progress bar, matrix table,
 * submit control, and the legend.
 *
 * What is NOT here (belongs in the page wrapper):
 *  - Page heading / description
 *  - Timer display in the header area
 *  - Page-level Reset button in the header
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, RotateCcw } from "lucide-react";
import Card from "../ui/Card";
import Button from "../ui/Button";

// ─── Theme ─────────────────────────────────────────────────────────────────────
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

const INITIAL_DIST: number[][] = [
  [   0,   3, INF,   7, INF ],
  [   8,   0,   2, INF, INF ],
  [   5, INF,   0,   1,   7 ],
  [   2, INF, INF,   0,   3 ],
  [INF,   1, INF, INF,   0  ],
];

const clone2D = (m: number[][]): number[][] => m.map((row) => [...row]);

interface Step {
  k: number;
  i: number;
  j: number;
  newValue: number;
  matrixSnapshot: number[][];
}

function computeAllSteps(initial: number[][]): Step[] {
  const dist = clone2D(initial);
  const steps: Step[] = [];
  for (let k = 0; k < N; k++) {
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        if (i === j) continue;
        const via = dist[i][k] === INF || dist[k][j] === INF ? INF : dist[i][k] + dist[k][j];
        if (via < dist[i][j]) {
          dist[i][j] = via;
          steps.push({ k, i, j, newValue: via, matrixSnapshot: clone2D(dist) });
        }
      }
    }
  }
  return steps;
}

type CellFlash = "correct" | "error" | null;

const fmt = (v: number): string => (v === INF ? "∞" : String(v));
const formatTime = (s: number): string =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

// ─── Props ─────────────────────────────────────────────────────────────────────
export interface FloydWarshallBoardProps {
  onWin?:   (seconds: number, score: number) => void;
  onReset?: () => void;
  /**
   * When provided the board is running inside GameSessionShell.
   * Shell controls round transitions; the board's own success overlay
   * is suppressed.
   *
   * correctActions = cells filled correctly this round
   * totalActions   = total cells that needed updating
   */
  onRoundComplete?: (payload: { correctActions: number; totalActions: number }) => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function FloydWarshallBoard({ onWin, onReset, onRoundComplete }: FloydWarshallBoardProps) {
  const [allSteps]  = useState<Step[]>(() => computeAllSteps(INITIAL_DIST));
  const [matrix,    setMatrix]    = useState<number[][]>(() => clone2D(INITIAL_DIST));
  const [stepIdx,   setStepIdx]   = useState(0);
  const [inputVal,  setInputVal]  = useState("");
  const [cellFlash, setCellFlash] = useState<CellFlash>(null);
  const [confirmed, setConfirmed] = useState<Set<string>>(() => new Set());
  const [seconds,   setSeconds]   = useState(0);
  const [running,   setRunning]   = useState(true);
  const [won,       setWon]       = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentStep = allSteps[stepIdx] ?? null;
  const totalSteps  = allSteps.length;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!won) inputRef.current?.focus();
  }, [stepIdx, won]);

  const handleSubmit = useCallback(() => {
    if (!currentStep || won) return;
    const parsed = inputVal.trim() === "∞" || inputVal.trim() === "inf"
      ? INF
      : Number(inputVal.trim());
    if (isNaN(parsed)) return;

    const correct = parsed === currentStep.newValue;
    if (correct) {
      setMatrix(currentStep.matrixSnapshot);
      setConfirmed((prev) => new Set(prev).add(`${currentStep.i}-${currentStep.j}`));
      setCellFlash("correct");
      setTimeout(() => setCellFlash(null), 600);
      setInputVal("");
      const next = stepIdx + 1;
      if (next >= totalSteps) {
        setWon(true);
        setRunning(false);
        onWin?.(seconds, next * 10);
        onRoundComplete?.({
          correctActions: next,        // every confirmed cell is a correct action
          totalActions:   totalSteps,
        });
      } else {
        setStepIdx(next);
      }
    } else {
      setCellFlash("error");
      setTimeout(() => setCellFlash(null), 600);
    }
  }, [currentStep, inputVal, stepIdx, totalSteps, won, seconds, onWin]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSubmit();
  };

  const handleReset = useCallback(() => {
    setMatrix(clone2D(INITIAL_DIST));
    setStepIdx(0);
    setInputVal("");
    setCellFlash(null);
    setConfirmed(new Set());
    setSeconds(0);
    setRunning(true);
    setWon(false);
    onReset?.();
  }, [onReset]);

  // ── Cell styling ──────────────────────────────────────────────────────────
  const isKRow      = (r: number) => currentStep !== null && r === currentStep.k;
  const isKCol      = (c: number) => currentStep !== null && c === currentStep.k;
  const isActive    = (r: number, c: number) => currentStep !== null && r === currentStep.i && c === currentStep.j;
  const isConfirmed = (r: number, c: number) => confirmed.has(`${r}-${c}`);

  function cellBg(r: number, c: number): string {
    if (isActive(r, c)) return "transparent";
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      {/* Intermediate node banner */}
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
            <span className="font-mono text-node font-semibold">{LABELS[currentStep.k]}</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <Card className="!p-4 flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-textMuted">Cells completed</span>
            <span className="font-mono text-xs text-textPrimary">{stepIdx} / {totalSteps}</span>
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
        <div className="text-right shrink-0">
          <p className="text-xs text-textMuted">Time</p>
          <p className="font-mono text-sm text-textPrimary tabular-nums">{formatTime(seconds)}</p>
        </div>
        <Button variant="secondary" onClick={handleReset} className="!px-3 !py-1.5 text-xs gap-1.5 shrink-0">
          <RotateCcw size={13} aria-hidden="true" /> Reset
        </Button>
      </Card>

      {/* Initial edge weights reference */}
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

      {/* Matrix grid */}
      <div className="overflow-x-auto">
        <div
          className="inline-block rounded-xl border border-panelBorder overflow-hidden shadow-panel"
          style={{ minWidth: "min-content" }}
          role="grid"
          aria-label="Floyd-Warshall distance matrix"
        >
          <table className="border-collapse" style={{ tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th
                  className="font-mono text-xs text-textMuted text-center"
                  style={{ width: 48, height: 48, background: C.panel, border: `1px solid ${C.panelBorder}`, padding: 0 }}
                  aria-hidden="true"
                >
                  <span style={{ color: C.textMuted, fontSize: 10 }}>i\j</span>
                </th>
                {LABELS.map((lbl, j) => (
                  <th
                    key={j}
                    style={{
                      width: 56, height: 48,
                      background: currentStep && j === currentStep.k ? "rgba(127,168,255,0.12)" : C.panel,
                      border: `1px solid ${C.panelBorder}`,
                      padding: 0,
                      transition: "background 0.3s",
                    }}
                    scope="col"
                  >
                    <span
                      className="font-mono text-sm font-bold"
                      style={{ color: currentStep && j === currentStep.k ? C.node : C.textMuted, display: "block", textAlign: "center" }}
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
                  <th
                    scope="row"
                    style={{
                      width: 48, height: 52,
                      background: currentStep && i === currentStep.k ? "rgba(127,168,255,0.12)" : C.panel,
                      border: `1px solid ${C.panelBorder}`,
                      padding: 0,
                      transition: "background 0.3s",
                    }}
                  >
                    <span
                      className="font-mono text-sm font-bold"
                      style={{ color: currentStep && i === currentStep.k ? C.node : C.textMuted, display: "block", textAlign: "center" }}
                    >
                      {LABELS[i]}
                    </span>
                  </th>
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
                              ? "inset 0 0 10px rgba(110,231,196,0.2)"
                              : cellFlash === "error"
                              ? "inset 0 0 10px rgba(255,107,138,0.2)"
                              : "inset 0 0 12px rgba(255,211,110,0.15)"
                            : "none",
                        }}
                      >
                        {active ? (
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
                                width: "100%", height: "100%",
                                background: "transparent", border: "none", outline: "none",
                                textAlign: "center",
                                fontFamily: "JetBrains Mono, monospace",
                                fontSize: "14px", fontWeight: 700,
                                color: cellFlash === "correct" ? C.teal : cellFlash === "error" ? C.error : C.gold,
                                caretColor: C.gold,
                                padding: 0,
                              }}
                              placeholder="?"
                              autoComplete="off"
                              spellCheck={false}
                            />
                          </motion.div>
                        ) : (
                          <span
                            style={{
                              width: "100%", height: "100%",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontFamily: "JetBrains Mono, monospace",
                              fontSize: "13px",
                              fontWeight: i === j ? 400 : 600,
                              color: cellTextColor(i, j),
                            }}
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

      {/* Submit */}
      {!won && currentStep && (
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={handleSubmit} className="!px-4 !py-2 text-sm">
            Confirm value
          </Button>
          <p className="text-xs text-textMuted font-mono">
            or press{" "}
            <kbd className="rounded border border-panelBorder bg-panel px-1.5 py-0.5 text-textPrimary" style={{ fontFamily: "inherit" }}>
              Enter
            </kbd>
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-textMuted">
        {[
          { color: C.gold,      label: "Active cell (your input)" },
          { color: C.teal,      label: "Confirmed correct"        },
          { color: C.node,      label: "Active k row/column"      },
          { color: C.textMuted, label: "No direct edge (∞)"       },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded-sm"
              style={{ background: color, opacity: 0.85 }}
              aria-hidden="true"
            />
            {label}
          </div>
        ))}
      </div>

      {/* Success overlay — suppressed when shell drives round transitions */}
      <AnimatePresence>
        {won && !onRoundComplete && (
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
                boxShadow: "0 0 0 2px rgba(110,231,196,0.25), 0 0 40px 10px rgba(110,231,196,0.15)",
              }}
            >
              <CheckCircle2 size={48} className="text-teal" aria-hidden="true" />
              <div className="flex flex-col gap-1">
                <h2 id="fw-success-title" className="font-sans text-xl font-bold text-textPrimary">
                  All Shortest Paths Computed!
                </h2>
                <p className="text-sm text-textMuted">
                  You filled all <span className="font-mono font-semibold text-textPrimary">{totalSteps}</span> updated cells correctly.
                </p>
                <p className="mt-1 text-sm text-textMuted">
                  Time: <span className="font-mono font-semibold text-textPrimary">{formatTime(seconds)}</span>
                  {"  ·  "}Score: <span className="font-mono font-bold text-gold">{totalSteps * 10}</span>
                </p>
              </div>
              <Button variant="primary" onClick={handleReset}>Play again</Button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
