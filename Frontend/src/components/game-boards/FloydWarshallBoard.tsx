/**
 * FloydWarshallBoard.tsx
 *
 * Core gameplay for the Floyd-Warshall Grid. Shows an N×N distance
 * matrix; the player clicks the correct updated value for each cell
 * the algorithm actually improves (cells with no improvement are
 * skipped automatically — see design plan). Reuses the same graph
 * generation utilities as DijkstraBoard.
 */

import { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, RotateCcw } from "lucide-react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { generateFloydWarshallRound, type FWRound } from "../../utils/graphGenerator";

const C = {
  panel: "#0D1130",
  panelBorder: "#2A3166",
  node: "#7FA8FF",
  gold: "#FFD36E",
  teal: "#6EE7C4",
  textPrimary: "#E8ECFB",
  textMuted: "#9199B5",
  error: "#FF6B8A",
} as const;

export interface FloydWarshallBoardProps {
  onReset?: () => void;
  onRoundComplete?: (payload: { correctActions: number; totalActions: number }) => void;
  round?: number;
}

function randomDistractor(correct: number, taken: Set<number>): number {
  let candidate: number;
  do {
    const delta = 1 + Math.floor(Math.random() * 6);
    candidate = Math.random() < 0.5 ? correct + delta : Math.max(1, correct - delta);
  } while (taken.has(candidate));
  return candidate;
}

function buildChips(correct: number): number[] {
  const taken = new Set<number>([correct]);
  const d1 = randomDistractor(correct, taken);
  taken.add(d1);
  const d2 = randomDistractor(correct, taken);
  const arr = [correct, d1, d2];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function FloydWarshallBoard({ onReset, onRoundComplete, round = 1 }: FloydWarshallBoardProps) {
  const [fw] = useState<FWRound>(() => generateFloydWarshallRound(round));
  const [matrix, setMatrix] = useState<number[][]>(() => fw.initialMatrix.map((r) => [...r]));
  const [stepIndex, setStepIndex] = useState(0);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [shakeCell, setShakeCell] = useState<string | null>(null);

  const n = fw.labels.length;
  const done = stepIndex >= fw.steps.length;
  const currentStep = fw.steps[stepIndex];

  const chips = useMemo(
    () => (currentStep ? buildChips(currentStep.newValue) : []),
    [stepIndex] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleChipClick = useCallback((value: number) => {
    if (!currentStep) return;
    if (value === currentStep.newValue) {
      setMatrix((prev) => {
        const next = prev.map((row) => [...row]);
        next[currentStep.i][currentStep.j] = currentStep.newValue;
        return next;
      });
      const nextIndex = stepIndex + 1;
      if (nextIndex >= fw.steps.length) {
        onRoundComplete?.({
          correctActions: fw.steps.length,
          totalActions: fw.steps.length + wrongAttempts,
        });
      }
      setStepIndex(nextIndex);
    } else {
      setWrongAttempts((w) => w + 1);
      const key = `${currentStep.i}-${currentStep.j}`;
      setShakeCell(key);
      setTimeout(() => setShakeCell(null), 400);
    }
  }, [currentStep, stepIndex, fw.steps.length, wrongAttempts, onRoundComplete]);

  const handleReset = useCallback(() => {
    setMatrix(fw.initialMatrix.map((r) => [...r]));
    setStepIndex(0);
    setWrongAttempts(0);
    setShakeCell(null);
    onReset?.();
  }, [fw.initialMatrix, onReset]);

  const isHighlightedRowCol = (idx: number) => currentStep != null && idx === currentStep.k;
  const isActiveCell = (i: number, j: number) =>
    currentStep != null && i === currentStep.i && j === currentStep.j;

  // ── Completed overlay (standalone use only, no shell) ─────────────
  if (done && !onRoundComplete) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6 py-16 text-center"
        >
          <CheckCircle2 size={56} className="text-teal drop-shadow-[0_0_12px_#6EE7C4]" aria-hidden="true" />
          <div>
            <h2 className="font-sans text-2xl font-bold text-textPrimary">All shortest paths computed!</h2>
            <p className="mt-1 text-sm text-textMuted">
              {fw.steps.length} updates applied across {n} nodes.
            </p>
          </div>
          <Button variant="secondary" onClick={handleReset} className="gap-2">
            <RotateCcw size={14} aria-hidden="true" /> Play again
          </Button>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      {/* Matrix */}
      <Card className="flex-1 min-w-0 !p-4 overflow-x-auto">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs uppercase tracking-widest text-textMuted">Processing via node:</span>
          <span className="font-mono text-lg font-bold text-gold">
            {currentStep ? fw.labels[currentStep.k] : "—"}
          </span>
        </div>

        <table className="border-separate" style={{ borderSpacing: 4 }}>
          <thead>
            <tr>
              <th className="w-10 h-10" />
              {fw.labels.map((label, j) => (
                <th
                  key={j}
                  className="w-12 h-10 font-mono text-xs text-textMuted"
                  style={{ background: isHighlightedRowCol(j) ? "rgba(255,211,110,0.08)" : "transparent" }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fw.labels.map((rowLabel, i) => (
              <tr key={i}>
                <th
                  className="w-10 h-10 font-mono text-xs text-textMuted"
                  style={{ background: isHighlightedRowCol(i) ? "rgba(255,211,110,0.08)" : "transparent" }}
                >
                  {rowLabel}
                </th>
                {fw.labels.map((_, j) => {
                  const value = matrix[i][j];
                  const active = isActiveCell(i, j);
                  const shaking = shakeCell === `${i}-${j}`;
                  const rowColActive = isHighlightedRowCol(i) || isHighlightedRowCol(j);
                  return (
                    <td
                      key={j}
                      className="w-12 h-10 text-center align-middle rounded-lg border font-mono text-sm"
                      style={{
                        background: active
                          ? "rgba(255,211,110,0.12)"
                          : rowColActive
                          ? "rgba(255,211,110,0.05)"
                          : C.panel,
                        borderColor: active ? C.gold : C.panelBorder,
                        borderWidth: active ? 2 : 1,
                        color: i === j ? C.textMuted : value === Infinity ? C.textMuted : C.textPrimary,
                        transform: shaking ? "translateX(2px)" : "none",
                        transition: "transform 0.1s",
                      }}
                    >
                      {value === Infinity ? "∞" : value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Chip panel */}
      <div className="w-full lg:w-64 shrink-0 flex flex-col gap-4">
        <Card className="flex flex-col gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-textMuted mb-1">Progress</p>
            <span className="font-mono text-2xl font-bold text-node">
              {stepIndex} / {fw.steps.length}
            </span>
          </div>

          {currentStep && (
            <div>
              <p className="text-xs uppercase tracking-widest text-textMuted mb-2">
                Update cell ({fw.labels[currentStep.i]}, {fw.labels[currentStep.j]})
              </p>
              <div className="flex flex-col gap-2">
                {chips.map((value, idx) => (
                  <motion.button
                    key={`${stepIndex}-${idx}`}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleChipClick(value)}
                    className="w-full rounded-lg border border-panelBorder bg-background/60 px-3 py-2 font-mono text-sm font-semibold text-textPrimary hover:border-gold/60 hover:bg-gold/5 transition-colors duration-200 min-h-[44px]"
                  >
                    {value}
                  </motion.button>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Button variant="secondary" onClick={handleReset} className="gap-1.5 !px-3 !py-1.5 text-xs w-full justify-center">
          <RotateCcw size={13} aria-hidden="true" /> Reset
        </Button>
      </div>
    </div>
  );
}