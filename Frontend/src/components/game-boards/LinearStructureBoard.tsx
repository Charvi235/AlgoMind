import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, CheckCircle2, Layers, ListOrdered, Loader2, RotateCcw } from "lucide-react";
import { socket } from "../../lib/socket";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { getToken } from "../../lib/auth";
type LinearGameType = "fifo" | "lifo";
type StructureItem = { id: number; value: number };
type StructureStep =
  | { type: "add"; item: StructureItem }
  | { type: "remove" };

interface ChallengeState {
  challengeId: string;
  gameType: LinearGameType;
  round: number;
  totalSteps: number;
  stepIndex: number;
  items: StructureItem[];
  step: StructureStep | null;
  completed: boolean;
  correctActions?: number;
  waitingForOpponent?: boolean;
}

interface SoloStepResult extends ChallengeState {
  correct: boolean;
  correctActions: number;
  score: number;
}

interface LinearStructureBoardProps {
  gameType?: LinearGameType;
  round?: number;
  sessionId?: string;
  mode?: "solo" | "live";
  roomId?: string;
  onRoundChange?: (round: number) => void;
  onRoundComplete?: (payload: {
    correctActions: number;
    totalActions: number;
    score?: number;
    completed?: boolean;
  }) => void;
}

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

async function fetchChallenge(
  gameType: LinearGameType,
  round: number,
  requestId: string,
  sessionId: string,
): Promise<ChallengeState> {
  const query = new URLSearchParams({
    gameType,
    round: String(round),
    requestId,
    sessionId,
  });

const token = getToken();

const response = await fetch(
  `${API_BASE}/api/games/linear-structures/new?${query}`,
  {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }
);

  const body = await response.json().catch(() => null) as
    | ChallengeState
    | { error?: string }
    | null;

  if (!response.ok || !body || !("challengeId" in body)) {
    throw new Error(
      body && "error" in body
        ? body.error ?? "Could not load challenge."
        : "Could not load challenge."
    );
  }

  return body;
}

async function submitSoloStep(
  challenge: ChallengeState,
  itemId?: number
): Promise<SoloStepResult> {
  const token = getToken();

const response = await fetch(`${API_BASE}/api/games/linear-structures/validate-step`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
    body: JSON.stringify({
      challengeId: challenge.challengeId,
      stepIndex: challenge.stepIndex,
      ...(itemId === undefined ? {} : { itemId }),
    }),
  });
  const body = await response.json().catch(() => null) as
    | SoloStepResult
    | { error?: string }
    | null;
  if (!response.ok || !body || !("correct" in body)) {
    throw new Error(body && "error" in body ? body.error ?? "Could not validate move." : "Could not validate move.");
  }
  return body;
}

export default function LinearStructureBoard({
  gameType = "fifo",
  round = 1,
  sessionId,
  mode = "solo",
  roomId,
  onRoundChange,
  onRoundComplete,
}: LinearStructureBoardProps) {
  const [challenge, setChallenge] = useState<ChallengeState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [combo, setCombo] = useState(0);
  const [wrongItemId, setWrongItemId] = useState<number | null>(null);
  const [retry, setRetry] = useState(0);
  const requestId = useRef(crypto.randomUUID());
  const reportedRound = useRef<string | null>(null);
  const requestTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    reportedRound.current = null;
if (mode === "solo") {
  let cancelled = false;

  if (!sessionId) {
    setLoadError("Session ID is missing. Please restart the game.");
    setLoading(false);
    return;
  }

  setLoading(true);
  setLoadError(null);

  fetchChallenge(gameType, round, requestId.current, sessionId)
    .then((result) => {
      if (!cancelled) setChallenge(result);
    })
    .catch((error: unknown) => {
      if (!cancelled) {
        setLoadError(
          error instanceof Error
            ? error.message
            : "Could not load challenge."
        );
      }
    })
    .finally(() => {
      if (!cancelled) setLoading(false);
    });

  return () => {
    cancelled = true;
  };
}

    const handleRoundState = (state: ChallengeState & { roomId: string }) => {
      if (state.roomId !== roomId || state.gameType !== gameType) return;
      setChallenge(state);
      setLoadError(null);
      setLoading(false);
      setSubmitting(false);
      setCombo(0);
      reportedRound.current = null;
      onRoundChange?.(state.round);
    };
    const handleStepResult = (result: ChallengeState & {
      roomId: string;
      correct: boolean;
      waitingForOpponent?: boolean;
      error?: string;
    }) => {
      if (result.roomId !== roomId) return;
      if (requestTimeout.current) clearTimeout(requestTimeout.current);
      setSubmitting(false);
      if (result.error) {
        setLoadError(result.error);
        return;
      }
      setChallenge(result);
      setLoadError(result.correct ? null : "Not the next item in this structure. Try again.");
      setCombo((value) => result.correct ? value + 1 : 0);
      setWrongItemId(null);
      if (result.completed) {
        const key = `${result.roomId}:${result.round}`;
        if (reportedRound.current !== key) {
          reportedRound.current = key;
          onRoundComplete?.({
            correctActions: result.totalSteps,
            totalActions: result.totalSteps,
            score: result.totalSteps * 10,
          });
        }
      }
    };

    socket.on("linear_round_state", handleRoundState);
    socket.on("linear_step_result", handleStepResult);
    socket.emit("request_linear_state");
    const retry = setTimeout(() => socket.emit("request_linear_state"), 400);
    return () => {
      clearTimeout(retry);
      if (requestTimeout.current) clearTimeout(requestTimeout.current);
      socket.off("linear_round_state", handleRoundState);
      socket.off("linear_step_result", handleStepResult);
    };
  }, [gameType, mode, onRoundChange, onRoundComplete, retry, roomId, round,sessionId,]);

  const submitAction = useCallback(async (itemId?: number) => {
    if (!challenge || !challenge.step || submitting || challenge.completed) return;
    setSubmitting(true);
    setLoadError(null);
    setWrongItemId(null);

    if (mode === "live") {
      const handleTimeout = () => {
        setSubmitting(false);
        setLoadError("The server did not respond. Please try that move again.");
      };
      requestTimeout.current = setTimeout(handleTimeout, 5000);
      socket.emit("submit_linear_step", {
        stepIndex: challenge.stepIndex,
        ...(itemId === undefined ? {} : { itemId }),
      });
      return;
    }

    try {
      const result = await submitSoloStep(challenge, itemId);
      setChallenge(result);
      setCombo((value) => result.correct ? value + 1 : 0);
      if (!result.correct && itemId !== undefined) setWrongItemId(itemId);
      setLoadError(result.correct ? null : "Not the next item in this structure. Try again.");
      if (result.completed) {
        const key = `${result.challengeId}:${result.round}`;
        if (reportedRound.current !== key) {
          reportedRound.current = key;
          onRoundComplete?.({
            correctActions: result.correctActions,
            totalActions: result.totalSteps,
            score: result.correctActions * 10,
          });
        }
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not validate move.");
    } finally {
      setSubmitting(false);
    }
  }, [challenge, mode, onRoundComplete, submitting]);

  const isQueue = gameType === "fifo";
  const StructureIcon = isQueue ? ListOrdered : Layers;
  const orderedItems = challenge?.items ?? [];
  const topItem = !isQueue ? orderedItems[orderedItems.length - 1] : null;
  const isEmpty = orderedItems.length === 0;
  const progress = challenge ? Math.round((challenge.stepIndex / challenge.totalSteps) * 100) : 0;

  if (loading) {
    return (
      <Card className="flex min-h-64 flex-col items-center justify-center gap-3 !p-10">
        <Loader2 className="animate-spin text-node" size={30} />
        <p className="text-sm text-textMuted">Building your {isQueue ? "queue" : "stack"} challenge…</p>
      </Card>
    );
  }

  if (loadError && !challenge) {
    return (
      <Card className="flex flex-col items-center gap-4 !p-8 text-center">
        <p role="alert" className="text-sm text-error">{loadError}</p>
        <Button variant="secondary" onClick={() => setRetry((value) => value + 1)}>
          <RotateCcw size={14} className="mr-2" /> Try again
        </Button>
      </Card>
    );
  }

  if (!challenge) return null;

  const completed = challenge.completed;
  const waiting = completed && mode === "live";

  return (
    <motion.div
      className="flex flex-col gap-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="flex flex-wrap items-center justify-between gap-4 !p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-panelBorder bg-background">
            <StructureIcon size={20} className="text-node" />
          </span>
          <div>
            <p className="text-sm font-bold text-textPrimary">
              {isQueue ? "First in line, first served" : "Last on, first off"}
            </p>
            <p className="text-xs text-textMuted">
              Round {challenge.round} · {challenge.totalSteps} operations
            </p>
            {mode === "live" && (
              <p className="mt-1 text-[10px] text-teal">
                Shared structure — moves by either player advance both views.
              </p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-lg font-bold text-gold">{challenge.stepIndex}/{challenge.totalSteps}</p>
          <p className="text-[10px] uppercase tracking-widest text-textMuted">Moves complete</p>
        </div>
      </Card>

      <Card className="!p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-textMuted">Next operation</p>
            <h2 className="mt-1 text-xl font-bold text-textPrimary">
              {completed
                ? waiting ? "Round cleared!" : "Challenge cleared!"
                : challenge.step?.type === "add"
                  ? `${isQueue ? "ENQUEUE" : "PUSH"} ${challenge.step.item.value}`
                  : isQueue ? "DEQUEUE the front item" : "POP the top item"}
            </h2>
          </div>
          {combo >= 3 && !completed && (
            <motion.span
              key={combo}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-bold text-gold"
            >
              {combo}x streak
            </motion.span>
          )}
        </div>

        <div className="mb-5 h-2 overflow-hidden rounded-full bg-background">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-node to-teal"
            animate={{ width: `${progress}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>

        {challenge.step?.type === "add" && !completed && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-node/30 bg-node/5 p-4">
            <div className="flex items-center gap-3">
              {isQueue ? <ArrowDown className="text-node" /> : <ArrowUp className="text-node" />}
              <span className="text-sm text-textPrimary">
                Add <strong className="font-mono text-gold">{challenge.step.item.value}</strong>
                {isQueue ? " to the back of the line." : " onto the top of the stack."}
              </span>
            </div>
            <Button disabled={submitting} onClick={() => void submitAction()}>
              {submitting ? <Loader2 className="mr-2 animate-spin" size={15} /> : null}
              {isQueue ? "Enqueue" : "Push"}
            </Button>
          </div>
        )}

       <div
  className={[
    "relative flex min-h-36 items-center justify-center gap-3 rounded-xl border border-dashed border-panelBorder bg-background/70 p-5",
    isQueue
      ? "flex-row flex-wrap"
      : "flex-col-reverse flex-nowrap",
  ].join(" ")}
  aria-label={isQueue ? "Queue contents" : "Stack contents"}
>
          <AnimatePresence mode="popLayout">
            {orderedItems.map((item, index) => {
              const isFront = isQueue && index === 0;
              const isRear = isQueue && index === orderedItems.length - 1;
              const isTop = !isQueue && index === orderedItems.length - 1;
              const isNext = isQueue ? isFront : isTop;
              const isWrong = wrongItemId === item.id;
              const canRemove = !completed && challenge.step?.type === "remove" && !submitting;
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.7, y: isQueue ? 0 : 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.7, y: isQueue ? 0 : -20 }}
                  className="flex flex-col items-center gap-1"
                >
                 {(isFront || isRear || isTop) && (
  <span className="min-h-4 whitespace-nowrap text-[9px] font-bold uppercase tracking-widest text-teal">
    {isFront && isRear
      ? "FRONT / REAR"
      : isFront
        ? "FRONT"
        : isRear
          ? "REAR"
          : "TOP"}
  </span>
)}
                  <motion.button
                    whileHover={canRemove ? { scale: 1.08 } : undefined}
                    whileTap={canRemove ? { scale: 0.94 } : undefined}
                    disabled={!canRemove}
                    onClick={() => void submitAction(item.id)}
                    aria-label={`${item.value}${canRemove ? `, select to ${isQueue ? "dequeue" : "pop"}` : ""}${isNext ? ", next out" : ""}`}
                    className={[
                      "flex h-14 min-w-14 items-center justify-center rounded-xl border px-3 font-mono text-base font-bold transition",
                      isWrong
                        ? "border-error bg-error/10 text-error"
                        : isNext
                          ? "border-gold/70 bg-gold/10 text-gold shadow-[0_0_16px_2px_#FFD36E22]"
                          : "border-panelBorder bg-panel text-textPrimary",
                      canRemove ? "cursor-pointer hover:border-teal hover:text-teal" : "cursor-default",
                    ].join(" ")}
                  >
                    {submitting && isNext ? <Loader2 className="animate-spin" size={18} /> : item.value}
                  </motion.button>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {isEmpty && (
            <p className="text-sm italic text-textMuted">
              {completed ? "Structure empty — nicely done!" : "Empty structure"}
            </p>
          )}
        </div>
        {isEmpty && (
          <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-widest text-textMuted">
            {isQueue ? "Front — · Rear —" : "Top —"}
          </p>
        )}
        {!isQueue && (
  <div className="mt-4 flex items-center justify-between rounded-xl border border-panelBorder bg-background/70 p-3">
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-textMuted">
        Peek Top
      </p>
      <p className="mt-1 font-mono text-lg font-bold text-gold">
        {topItem ? topItem.value : "Stack is empty"}
      </p>
    </div>
    <Button
      variant="secondary"
      disabled={!topItem}
      onClick={() => {
        if (topItem) {
          setLoadError(`Top element is ${topItem.value}. Stack unchanged.`);
        }
      }}
    >
      <Layers size={15} className="mr-2" />
      Peek
    </Button>
  </div>
)}
        {challenge.step?.type === "remove" && !completed && (
          <p className="mt-3 text-center text-xs text-textMuted">
            Select the highlighted {isQueue ? "front" : "top"} item to remove it.
          </p>
        )}
      </Card>

      <AnimatePresence>
        {loadError && challenge && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-center text-sm text-error"
          >
            {loadError}
          </motion.p>
        )}
        {completed && mode === "solo" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 text-sm font-semibold text-teal"
          >
            <CheckCircle2 size={17} /> Round complete — next round gets tougher!
          </motion.div>
        )}
        {waiting && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-sm text-textMuted"
          >
            Waiting for your opponent to clear this round…
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
