/**
 * SortingBoard.tsx
 *
 * Core gameplay UI for "Sorting Showdown".
 * The player performs Bubble / Insertion / Selection sort by hand.
 * All algorithm logic lives in utils/sortingEngine.ts — this file is UI only.
 *
 * Inside GameSessionShell:
 *   • `round` picks the algorithm (bubble → insertion → selection → …)
 *   • `onRoundComplete` fires once the array is fully sorted.
 *       correctActions = number of steps in the round
 *       totalActions   = steps + wrong answers   (so accuracy reflects mistakes)
 *
 * Standalone (no onRoundComplete): shows its own "Sorted!" card with a
 * "Next array" button.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ArrowLeftRight, Equal } from "lucide-react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import type { RoundCompletePayload } from "../../types/session";
import {
  ALGO_INFO,
  algoForRound,
  buildSortRound,
  randomAlgo,
  type SortRound,
} from "../../utils/sortingEngine";

// ─── Theme ─────────────────────────────────────────────────────────────────────
const C = {
  panel:       "#0D1130",
  panelBorder: "#2A3166",
  node:        "#7FA8FF",
  gold:        "#FFD36E",
  teal:        "#6EE7C4",
  textPrimary: "#E8ECFB",
  textMuted:   "#9199B5",
  error:       "#FF6B8A",
} as const;

// ─── Props ─────────────────────────────────────────────────────────────────────
export interface SortingBoardProps {
  /** Passed by GameSessionShell — decides which algorithm this round uses */
  round?:           number;
  onRoundComplete?: (payload: RoundCompletePayload) => void;
  onReset?:         () => void;
}

const MIN_BAR = 56;   // px
const MAX_BAR = 170;  // px

// ─── Component ─────────────────────────────────────────────────────────────────
export default function SortingBoard({ round, onRoundComplete, onReset }: SortingBoardProps) {
  const [game, setGame] = useState<SortRound>(() =>
    buildSortRound(round !== undefined ? algoForRound(round) : randomAlgo())
  );
  const [stepIdx,  setStepIdx]  = useState(0);
  const [mistakes, setMistakes] = useState(0);
  /** Which bar index (or "pair") is flashing red after a wrong answer */
  const [errorIdx, setErrorIdx] = useState<number[]>([]);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reported   = useRef(false);

  const info  = ALGO_INFO[game.algo];
  const total = game.steps.length;
  const done  = stepIdx >= total;
  const step  = done ? null : game.steps[stepIdx];

  const arr    = done ? game.finalArr : step!.arr;
  const sorted = done ? new Set(arr.map((_, i) => i)) : new Set(step!.sorted);
  const focus  = new Set(step?.focus ?? []);
  const maxVal = Math.max(...arr.map((x) => x.value));

  // ── Report completion exactly once ───────────────────────────────────────────
  useEffect(() => {
    if (!done || reported.current) return;
    reported.current = true;
    // TODO: POST { algo, steps: total, mistakes } to /api/games/sorting/submit
    onRoundComplete?.({ correctActions: total, totalActions: total + mistakes });
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (errorTimer.current) clearTimeout(errorTimer.current); }, []);

  // ── Answer handling ──────────────────────────────────────────────────────────
  const flashError = useCallback((indices: number[]) => {
    setMistakes((m) => m + 1);
    setErrorIdx(indices);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setErrorIdx([]), 450);
  }, []);

  const handleSwapKeep = useCallback(
    (wantsSwap: boolean) => {
      if (!step || step.kind !== "swap-or-keep") return;
      // TODO: validate server-side via /api/games/sorting/validate-step
      if (wantsSwap === step.answer) setStepIdx((i) => i + 1);
      else flashError(step.focus);
    },
    [step, flashError]
  );

  const handlePick = useCallback(
    (idx: number) => {
      if (!step || step.kind !== "pick-min") return;
      const [lo, hi] = step.range!;
      if (idx < lo || idx > hi) return;
      if (idx === step.answer) setStepIdx((i) => i + 1);
      else flashError([idx]);
    },
    [step, flashError]
  );

  // Keyboard: S = swap, K = keep (compare-style algorithms)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "s" || e.key === "S") handleSwapKeep(true);
      if (e.key === "k" || e.key === "K") handleSwapKeep(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSwapKeep]);

  // ── Standalone "next array" ─────────────────────────────────────────────────
  const handleNext = useCallback(() => {
    reported.current = false;
    setGame(buildSortRound(randomAlgo()));
    setStepIdx(0);
    setMistakes(0);
    setErrorIdx([]);
    onReset?.();
  }, [onReset]);

  // ── Bar styling ─────────────────────────────────────────────────────────────
  const barColors = (idx: number) => {
    if (errorIdx.includes(idx)) return { border: C.error, bg: "rgba(255,107,138,0.18)", text: C.error,  glow: "0 0 16px 4px rgba(255,107,138,0.35)" };
    if (focus.has(idx))         return { border: C.gold,  bg: "rgba(255,211,110,0.16)", text: C.gold,   glow: "0 0 16px 5px rgba(255,211,110,0.30)" };
    if (sorted.has(idx))        return { border: C.teal,  bg: "rgba(110,231,196,0.14)", text: C.teal,   glow: "0 0 10px 2px rgba(110,231,196,0.20)" };
    return                             { border: C.node,  bg: "rgba(127,168,255,0.10)", text: C.textPrimary, glow: "none" };
  };

  const pickMode = step?.kind === "pick-min";
  const [lo, hi] = step?.range ?? [0, -1];

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-6 py-4">
      {/* Header: algorithm + progress */}
      <div className="w-full max-w-xl flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 className="font-sans text-xl font-bold text-textPrimary">{info.title}</h2>
          <span className="font-mono text-xs text-textMuted">
            avg. time {info.complexity} · step {Math.min(stepIdx + 1, total)}/{total}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-panelBorder/40 overflow-hidden" aria-hidden="true">
          <motion.div
            className="h-full rounded-full bg-teal"
            animate={{ width: `${(stepIdx / total) * 100}%` }}
            transition={{ duration: 0.25 }}
          />
        </div>
        <p className="text-sm text-textMuted" aria-live="polite">{info.rule}</p>
      </div>

      {/* Bars */}
      <Card className="w-full max-w-xl !py-8">
        <div
          className="flex items-end justify-center gap-3 sm:gap-4"
          style={{ height: MAX_BAR + 8 }}
          role="group"
          aria-label="Array to sort"
        >
          {arr.map((item, idx) => {
            const col       = barColors(idx);
            const clickable = pickMode && idx >= lo && idx <= hi;
            const dimmed    = pickMode && !clickable && !done;
            const height    = MIN_BAR + (item.value / maxVal) * (MAX_BAR - MIN_BAR);
            return (
              <motion.button
                key={item.id}
                layout
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                animate={errorIdx.includes(idx) ? { x: [-4, 4, -4, 4, 0] } : { x: 0 }}
                whileHover={clickable ? { scale: 1.05 } : undefined}
                whileTap={clickable ? { scale: 0.95 } : undefined}
                onClick={() => handlePick(idx)}
                disabled={!clickable}
                aria-label={`Value ${item.value}`}
                className="flex w-12 sm:w-16 items-start justify-center rounded-lg pt-2 font-mono text-base sm:text-lg font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                style={{
                  height,
                  border:     `2px solid ${col.border}`,
                  background: col.bg,
                  color:      col.text,
                  boxShadow:  col.glow,
                  opacity:    dimmed ? 0.4 : 1,
                  cursor:     clickable ? "pointer" : "default",
                  transition: "border-color 0.2s, background 0.2s, box-shadow 0.2s, opacity 0.2s",
                }}
              >
                {item.value}
              </motion.button>
            );
          })}
        </div>
      </Card>

      {/* Controls */}
      {!done && step?.kind === "swap-or-keep" && (
        <div className="flex gap-3">
          <Button variant="primary" onClick={() => handleSwapKeep(true)} className="gap-2 min-w-[120px] justify-center">
            <ArrowLeftRight size={16} aria-hidden="true" /> Swap <kbd className="ml-1 text-[10px] opacity-60">S</kbd>
          </Button>
          <Button variant="secondary" onClick={() => handleSwapKeep(false)} className="gap-2 min-w-[120px] justify-center">
            <Equal size={16} aria-hidden="true" /> Keep <kbd className="ml-1 text-[10px] opacity-60">K</kbd>
          </Button>
        </div>
      )}

      {pickMode && !done && (
        <p className="text-xs uppercase tracking-widest text-textMuted">Tap the smallest bar in the unsorted section</p>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap justify-center text-xs text-textMuted">
        {[
          { c: C.node, l: "Unsorted" },
          { c: C.gold, l: "Comparing" },
          { c: C.teal, l: "Sorted"    },
        ].map(({ c, l }) => (
          <span key={l} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} /> {l}
          </span>
        ))}
        <span className="font-mono">mistakes: <span style={{ color: mistakes ? C.error : C.textMuted }}>{mistakes}</span></span>
      </div>

      {/* Sorted banner */}
      <AnimatePresence>
        {done && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{    opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="w-full max-w-sm"
          >
            <Card className="flex flex-col items-center gap-3 text-center !border-teal">
              <CheckCircle2 size={36} className="text-teal" aria-hidden="true" />
              <p className="font-sans text-lg font-bold text-textPrimary">Sorted!</p>
              <p className="font-mono text-sm text-teal">{game.finalArr.map((x) => x.value).join(" ≤ ")}</p>
              <p className="text-xs text-textMuted">
                {total} steps · {mistakes} mistake{mistakes === 1 ? "" : "s"}
              </p>
              {!onRoundComplete && <Button variant="primary" onClick={handleNext}>Next array</Button>}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
