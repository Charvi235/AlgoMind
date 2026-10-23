import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ArrowLeftRight, Equal } from "lucide-react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { socket } from "../../lib/socket";
import type { RoundCompletePayload } from "../../types/session";
import {
  ALGO_INFO,
  type ActiveSortRound,
  type SortAlgo,
} from "../../utils/SortingEngine";

const C = {
  panelBorder: "#2A3166",
  node: "#7FA8FF",
  gold: "#FFD36E",
  teal: "#6EE7C4",
  textPrimary: "#E8ECFB",
  textMuted: "#9199B5",
  error: "#FF6B8A",
} as const;

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const MIN_BAR = 56;
const MAX_BAR = 170;

export interface SortingBoardProps {
  round?: number;
  mode?: "solo" | "live";
  roomId?: string;
  onRoundChange?: (round: number) => void;
  onRoundComplete?: (payload: RoundCompletePayload) => void;
  onReset?: () => void;
}

async function fetchRound(round: number): Promise<ActiveSortRound> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/games/sorting/new?round=${round}`);
  } catch {
    throw new Error(`Cannot reach the backend at ${API_BASE}. Start the backend and verify its MongoDB connection.`);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? `Could not create a sorting round (HTTP ${response.status}).`);
  }
  return response.json();
}

async function submitAnswer(
  roundId: string,
  answer: boolean | number | string
): Promise<ActiveSortRound & { correct: boolean }> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/games/sorting/validate-step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roundId, answer }),
    });
  } catch {
    throw new Error(`Cannot reach the backend at ${API_BASE}. Start the backend and verify its MongoDB connection.`);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? `Could not validate that sorting step (HTTP ${response.status}).`);
  }
  return response.json();
}

export default function SortingBoard({
  round,
  mode = "solo",
  roomId,
  onRoundChange,
  onRoundComplete,
  onReset,
}: SortingBoardProps) {
  const [standaloneRound, setStandaloneRound] = useState(1);
  const activeRound = round ?? standaloneRound;
  const [game, setGame] = useState<ActiveSortRound | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [revealedHintKey, setRevealedHintKey] = useState<string | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [errorIdx, setErrorIdx] = useState<number[]>([]);
  const [reload, setReload] = useState(0);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reported = useRef(false);

  useEffect(() => {
    if (mode === "live") return;
    let cancelled = false;

    fetchRound(activeRound)
      .then((result) => {
        if (!cancelled) setGame(result);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Could not load the sorting round.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeRound, reload, mode]);

  useEffect(() => {
    if (mode !== "live" || !roomId) return;

    const requestState = () => socket.emit("request_sorting_state");
    const handleRound = (data: { round: number }) => {
      onRoundChange?.(data.round);
      requestState();
    };
    const handleState = (data: {
      roomId: string;
      round: number;
      algo: SortAlgo;
      totalSteps: number;
      stepIndex: number;
      step: ActiveSortRound["step"];
      completed: boolean;
      finalArr?: ActiveSortRound["finalArr"];
    }) => {
      if (data.roomId !== roomId) return;
      reported.current = false;
      setLoadError(null);
      setGame({
        roundId: roomId,
        algo: data.algo,
        stepIndex: data.stepIndex,
        totalSteps: data.totalSteps,
        step: data.step,
        completed: data.completed,
        finalArr: data.finalArr,
      });
      setLoading(false);
      setValidating(false);
      setErrorIdx([]);
      setMistakes(0);
      onRoundChange?.(data.round);
    };
    const handleSocketError = ({ message }: { message: string }) => {
      setLoadError(message);
      setLoading(false);
      setValidating(false);
    };

    socket.on("sorting_match_start", handleRound);
    socket.on("sorting_round_data", handleRound);
    socket.on("sorting_round_state", handleState);
    socket.on("sorting_room_error", handleSocketError);
    socket.emit("request_sorting_state");

    return () => {
      socket.off("sorting_match_start", handleRound);
      socket.off("sorting_round_data", handleRound);
      socket.off("sorting_round_state", handleState);
      socket.off("sorting_room_error", handleSocketError);
    };
  }, [mode, roomId, onRoundChange]);

  const step = game?.step ?? null;
  const done = game?.completed ?? false;
  const total = game?.totalSteps ?? 0;
  const arr = done ? game?.finalArr ?? [] : step?.arr ?? [];
  const info = game ? ALGO_INFO[game.algo as SortAlgo] : null;
  const focus = new Set(step?.focus ?? []);
  const sorted = new Set(done ? arr.map((_, index) => index) : step?.sorted ?? []);
  const maxVal = Math.max(1, ...arr.map((item) => item.value));

  useEffect(() => {
    if (!done || !game || reported.current) return;
    reported.current = true;
    onRoundComplete?.({
      correctActions: total,
      totalActions: total + mistakes,
    });
  }, [done, game, mistakes, onRoundComplete, total]);

  useEffect(() => () => {
    if (errorTimer.current) clearTimeout(errorTimer.current);
  }, []);

  const flashError = useCallback((indices: number[]) => {
    setMistakes((count) => count + 1);
    setErrorIdx(indices);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setErrorIdx([]), 450);
  }, []);

  const handleAnswer = useCallback(async (answer: boolean | number | string) => {
    if (!game || !step || validating || done) return;
    setValidating(true);
    if (mode === "live") {
      const onResult = (result: {
        correct: boolean;
        roomId: string;
        round: number;
        algo: SortAlgo;
        totalSteps: number;
        stepIndex: number;
        step: ActiveSortRound["step"];
        completed: boolean;
        finalArr?: ActiveSortRound["finalArr"];
      }) => {
        socket.off("sorting_step_result", onResult);
        clearTimeout(timeout);
        setValidating(false);
        if (result.roomId !== roomId) return;
        setLoadError(null);
        setGame({
          roundId: roomId ?? "",
          algo: result.algo,
          stepIndex: result.stepIndex,
          totalSteps: result.totalSteps,
          step: result.step,
          completed: result.completed,
          finalArr: result.finalArr,
        });
        if (!result.correct) flashError(step.focus);
        else setErrorIdx([]);
      };
      const timeout = setTimeout(() => {
        socket.off("sorting_step_result", onResult);
        setValidating(false);
        setLoadError("The server did not respond. Please try that step again.");
      }, 5000);
      socket.on("sorting_step_result", onResult);
      socket.emit("submit_sorting_step", { answer });
      return;
    }
    try {
      const result = await submitAnswer(game.roundId, answer);
      setLoadError(null);
      setGame({
        roundId: game.roundId,
        algo: game.algo,
        stepIndex: result.stepIndex,
        totalSteps: result.totalSteps,
        step: result.step,
        completed: result.completed,
        finalArr: result.finalArr,
      });
      if (!result.correct) flashError(step.focus);
      else setErrorIdx([]);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not validate that sorting step.");
    } finally {
      setValidating(false);
    }
  }, [game, step, validating, done, flashError, mode, roomId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "s" || event.key === "S") void handleAnswer(true);
      if (event.key === "k" || event.key === "K") void handleAnswer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleAnswer]);

  const handlePick = (index: number) => {
    if (step?.kind === "pick-min") void handleAnswer(index);
  };

  const handleNext = () => {
    reported.current = false;
    setLoading(true);
    setLoadError(null);
    setGame(null);
    setMistakes(0);
    setErrorIdx([]);
    if (mode === "live") return;
    if (round === undefined) setStandaloneRound((current) => current + 1);
    else setReload((current) => current + 1);
    onReset?.();
  };

  const handleRetry = () => {
    setLoading(true);
    setLoadError(null);
    setGame(null);
    setMistakes(0);
    setErrorIdx([]);
    setReload((current) => current + 1);
  };

  const barColors = (index: number) => {
    if (errorIdx.includes(index)) {
      return { border: C.error, bg: "rgba(255,107,138,0.18)", text: C.error, glow: "0 0 16px 4px rgba(255,107,138,0.35)" };
    }
    if (focus.has(index)) {
      return { border: C.gold, bg: "rgba(255,211,110,0.16)", text: C.gold, glow: "0 0 16px 5px rgba(255,211,110,0.30)" };
    }
    if (sorted.has(index)) {
      return { border: C.teal, bg: "rgba(110,231,196,0.14)", text: C.teal, glow: "0 0 10px 2px rgba(110,231,196,0.20)" };
    }
    return { border: C.node, bg: "rgba(127,168,255,0.10)", text: C.textPrimary, glow: "none" };
  };

  if (loading) {
    return <p className="py-12 text-center text-sm text-textMuted">Loading sorting round…</p>;
  }
  if (loadError && !game) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <p role="alert" className="text-sm text-error">{loadError}</p>
        {mode === "solo" && <Button variant="secondary" onClick={handleRetry}>Try again</Button>}
      </div>
    );
  }
  if (!game || !info) return null;

  const pickMode = step?.kind === "pick-min";
  const [lo, hi] = step?.range ?? [0, -1];
  const progress = total > 0 ? game.stepIndex / total : 1;
  const hintKey = `${activeRound}:${game.algo}`;

  return (
    <div className="flex flex-col gap-4 py-4 lg:flex-row lg:items-start">
      <div className="flex-1 min-w-0 flex flex-col items-center gap-6">
        {loadError && <p role="alert" className="text-sm text-error">{loadError}</p>}

        <div className="w-full max-w-xl flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 className="font-sans text-xl font-bold text-textPrimary">{info.title}</h2>
          <span className="font-mono text-xs text-textMuted">
            avg. time {info.complexity} · step {Math.min(game.stepIndex + 1, total)}/{total}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-panelBorder/40 overflow-hidden" aria-hidden="true">
          <motion.div
            className="h-full rounded-full bg-teal"
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.25 }}
          />
        </div>
        {step?.prompt && <p className="text-sm text-textMuted" aria-live="polite">{step.prompt}</p>}
        {validating && <p className="text-xs text-textMuted">Checking your answer…</p>}
        </div>

        <Card className="w-full max-w-xl !py-8">
        <div
          className="flex items-end justify-center gap-3 sm:gap-4"
          style={{ height: MAX_BAR + 8 }}
          role="group"
          aria-label="Array to sort"
        >
          {arr.map((item, index) => {
            const color = barColors(index);
            const clickable = pickMode && index >= lo && index <= hi && !validating;
            const dimmed = pickMode && !clickable && !done;
            const height = MIN_BAR + (item.value / maxVal) * (MAX_BAR - MIN_BAR);
            return (
              <motion.button
                key={item.id}
                layout
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                animate={errorIdx.includes(index) ? { x: [-4, 4, -4, 4, 0] } : { x: 0 }}
                whileHover={clickable ? { scale: 1.05 } : undefined}
                whileTap={clickable ? { scale: 0.95 } : undefined}
                onClick={() => handlePick(index)}
                disabled={!clickable}
                aria-label={`Value ${item.value}`}
                className="flex w-12 sm:w-16 items-start justify-center rounded-lg pt-2 font-mono text-base sm:text-lg font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                style={{
                  height,
                  border: `2px solid ${color.border}`,
                  background: color.bg,
                  color: color.text,
                  boxShadow: color.glow,
                  opacity: dimmed ? 0.4 : 1,
                  cursor: clickable ? "pointer" : "default",
                  transition: "border-color 0.2s, background 0.2s, box-shadow 0.2s, opacity 0.2s",
                }}
              >
                {item.value}
              </motion.button>
            );
          })}
        </div>
        </Card>

      {!done && step?.kind === "swap-or-keep" && (
        <div className="flex gap-3">
          <Button variant="primary" disabled={validating} onClick={() => void handleAnswer(true)} className="gap-2 min-w-[120px] justify-center">
            <ArrowLeftRight size={16} aria-hidden="true" /> Swap <kbd className="ml-1 text-[10px] opacity-60">S</kbd>
          </Button>
          <Button variant="secondary" disabled={validating} onClick={() => void handleAnswer(false)} className="gap-2 min-w-[120px] justify-center">
            <Equal size={16} aria-hidden="true" /> Keep <kbd className="ml-1 text-[10px] opacity-60">K</kbd>
          </Button>
        </div>
      )}

      {!done && step?.kind === "pick-choice" && (
        <div className="flex flex-wrap justify-center gap-3">
          {step.choices?.map((choice) => (
            <Button
              key={choice.value}
              variant="primary"
              disabled={validating}
              onClick={() => void handleAnswer(choice.value)}
            >
              {choice.label}
            </Button>
          ))}
        </div>
      )}

      {pickMode && !done && (
        <p className="text-xs uppercase tracking-widest text-textMuted">Tap the smallest bar in the unsorted section</p>
      )}

        <div className="flex items-center gap-4 flex-wrap justify-center text-xs text-textMuted">
        {[
          { color: C.node, label: "Unsorted" },
          { color: C.gold, label: "Current step" },
          { color: C.teal, label: "Sorted" },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} /> {label}
          </span>
        ))}
        <span className="font-mono">
          mistakes: <span style={{ color: mistakes ? C.error : C.textMuted }}>{mistakes}</span>
        </span>
        </div>

        <AnimatePresence>
        {done && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="w-full max-w-sm"
          >
            <Card className="flex flex-col items-center gap-3 text-center !border-teal">
              <CheckCircle2 size={36} className="text-teal" aria-hidden="true" />
              <p className="font-sans text-lg font-bold text-textPrimary">Sorted!</p>
              <p className="font-mono text-sm text-teal">{arr.map((item) => item.value).join(" ≤ ")}</p>
              <p className="text-xs text-textMuted">
                {total} steps · {mistakes} mistake{mistakes === 1 ? "" : "s"}
              </p>
              {mode === "live" ? (
                <p className="text-xs text-textMuted">Waiting for your friend to finish this round…</p>
              ) : (
                !onRoundComplete && <Button variant="primary" onClick={handleNext}>Next array</Button>
              )}
            </Card>
          </motion.div>
        )}
        </AnimatePresence>
      </div>

      <aside className="w-full shrink-0 flex flex-col gap-4 lg:w-72">
        <Card className="flex flex-col gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-textMuted mb-1">Algorithm</p>
            <h3 className="font-sans text-lg font-bold text-textPrimary">{info.title}</h3>
            <p className="mt-1 text-xs text-textMuted">Time complexity: {info.complexity}</p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-widest text-textMuted mb-2">How it works</p>
            <p className="text-sm text-textMuted">{info.rule}</p>
          </div>

          {!done && (
            <div>
              {revealedHintKey === hintKey ? (
                <>
                  <p className="text-xs uppercase tracking-widest text-gold mb-2">Hint used</p>
                  <p className="text-sm text-textPrimary" role="status">{info.hint}</p>
                </>
              ) : (
                <Button
                  variant="secondary"
                  className="w-full justify-center"
                  onClick={() => setRevealedHintKey(hintKey)}
                >
                  Show this round&apos;s hint
                </Button>
              )}
            </div>
          )}
        </Card>

        <Card className="!p-4 flex flex-col gap-2">
          <p className="text-xs uppercase tracking-widest text-textMuted mb-1">Legend</p>
          {[
            { color: C.node, label: "Unsorted bar" },
            { color: C.gold, label: "Current step" },
            { color: C.teal, label: "Sorted bar" },
            { color: C.error, label: "Incorrect choice" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ background: color }} aria-hidden="true" />
              <span className="text-xs text-textMuted">{label}</span>
            </div>
          ))}
        </Card>
      </aside>
    </div>
  );
}
