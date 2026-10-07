/**
 * DijkstraBoard.tsx
 *
 * Core gameplay UI for Dijkstra's Adventure.
 * - Solo mode: fetches a fresh graph via REST, validates each move via REST.
 * - Live mode: receives rounds pushed by the server over Socket.io,
 *   validates each move via a socket round-trip. Server is authoritative
 *   in both modes — no graph or shortest-path logic runs on the client.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, CheckCircle2, RotateCcw } from "lucide-react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { socket } from "../../lib/socket";
import type { SimpleNode, SimpleEdge } from "../../utils/graphGenerator";


// ─── Theme constants ───────────────────────────────────────────────
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

const VIEW_W = 520;
const VIEW_H = 340;
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

// ─── Server graph shape ────────────────────────────────────────────
interface ServerGraph {
  graphId?: string; // present in solo mode (REST), absent in live mode (socket)
  nodes: SimpleNode[];
  edges: SimpleEdge[];
  start: string;
  target: string;
}

async function fetchNewGraph(round: number): Promise<ServerGraph> {
  const res = await fetch(`${API_BASE}/api/games/dijkstra/new?round=${round}`);
  if (!res.ok) throw new Error("Failed to fetch graph");
  return res.json();
}

async function validateStep(
  graphId: string,
  currentNode: string,
  chosenNode: string
): Promise<{ correct: boolean; isComplete: boolean }> {
  const res = await fetch(`${API_BASE}/api/games/dijkstra/validate-step`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ graphId, currentNode, chosenNode }),
  });
  if (!res.ok) throw new Error("Failed to validate step");
  return res.json();
}

// ─── Layout (D3 force simulation, run synchronously once per round) ─
interface LaidOutNode extends SimpleNode { x: number; y: number; }

function computeForceLayout(nodes: SimpleNode[], edges: SimpleEdge[]): LaidOutNode[] {
  const simNodes = nodes.map((n) => ({
    ...n,
    x: VIEW_W / 2 + (Math.random() - 0.5) * 40,
    y: VIEW_H / 2 + (Math.random() - 0.5) * 40,
  })) as (SimpleNode & d3.SimulationNodeDatum)[];

  const simLinks = edges.map((e) => ({ ...e })) as unknown as d3.SimulationLinkDatum<
    (typeof simNodes)[number]
  >[];

  const simulation = d3
    .forceSimulation(simNodes)
    .force("link", d3.forceLink(simLinks).id((d: any) => d.id).distance(95).strength(0.9))
    .force("charge", d3.forceManyBody().strength(-260))
    .force("center", d3.forceCenter(VIEW_W / 2, VIEW_H / 2))
    .force("collide", d3.forceCollide(34))
    .stop();

  for (let i = 0; i < 300; i++) simulation.tick();

  const PAD = 36;
  return simNodes.map((n) => ({
    id: n.id,
    label: (n as SimpleNode).label,
    x: Math.max(PAD, Math.min(VIEW_W - PAD, n.x ?? VIEW_W / 2)),
    y: Math.max(PAD, Math.min(VIEW_H - PAD, n.y ?? VIEW_H / 2)),
  }));
}

// ─── Client-side helpers (hint-path display only, never used for validation) ─
function buildAdjacency(edges: SimpleEdge[]) {
  const adj = new Map<string, { id: string; weight: number }[]>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    if (!adj.has(e.target)) adj.set(e.target, []);
    adj.get(e.source)!.push({ id: e.target, weight: e.weight });
    adj.get(e.target)!.push({ id: e.source, weight: e.weight });
  }
  return adj;
}

function dijkstra(start: string, nodes: SimpleNode[], edges: SimpleEdge[]) {
  const adj = buildAdjacency(edges);
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const visited = new Set<string>();
  for (const n of nodes) { dist.set(n.id, Infinity); prev.set(n.id, null); }
  dist.set(start, 0);
  const queue = new Set(nodes.map((n) => n.id));
  while (queue.size) {
    let u = ""; let minD = Infinity;
    for (const id of queue) { const d = dist.get(id)!; if (d < minD) { minD = d; u = id; } }
    if (!u || minD === Infinity) break;
    queue.delete(u); visited.add(u);
    for (const { id: v, weight } of adj.get(u) ?? []) {
      if (visited.has(v)) continue;
      const alt = dist.get(u)! + weight;
      if (alt < dist.get(v)!) { dist.set(v, alt); prev.set(v, u); }
    }
  }
  return { dist, prev };
}

function buildOptimalPath(target: string, prev: Map<string, string | null>): string[] {
  const path: string[] = [];
  let cur: string | null = target;
  while (cur) { path.unshift(cur); cur = prev.get(cur) ?? null; }
  return path;
}

const edgeKey = (a: string, b: string) => [a, b].sort().join("--");
type EdgeState = "default" | "traveled" | "error";

interface GameState {
  currentNode:   string;
  visitedNodes:  Set<string>;
  traveledEdges: Map<string, EdgeState>;
  path:          string[];
  won:           boolean;
}

function initGameState(start: string): GameState {
  return {
    currentNode: start,
    visitedNodes: new Set([start]),
    traveledEdges: new Map(),
    path: [start],
    won: false,
  };
}

// ─── Props ─────────────────────────────────────────────────────────
export interface DijkstraBoardProps {
  onWin?: (seconds: number) => void;
  onReset?: () => void;
  onRoundComplete?: (payload: { correctActions: number; totalActions: number }) => void;
  round?: number;
  /** "solo" (default) fetches via REST. "live" uses Socket.io, server-pushed rounds. */
  mode?: "solo" | "live";
  /** Live mode only — lets the shell display the server-authoritative round number. */
  onRoundChange?: (round: number) => void;
}

// ─── Component ─────────────────────────────────────────────────────
export default function DijkstraBoard({
  onWin, onReset, onRoundComplete, round = 1, mode = "solo", onRoundChange,
}: DijkstraBoardProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const [graph, setGraph] = useState<ServerGraph | null>(null);
  const [laidOutNodes, setLaidOutNodes] = useState<LaidOutNode[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [game,       setGame]       = useState<GameState | null>(null);
  const [seconds,    setSeconds]    = useState(0);
  const [running,    setRunning]    = useState(true);
  const [flashEdge,  setFlashEdge]  = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

  // ── Solo mode: fetch a fresh graph via REST ─────────────────────
  useEffect(() => {
    if (mode !== "solo") return;
    let cancelled = false;
    setLoadError(null);
    fetchNewGraph(round)
      .then((g) => {
        if (cancelled) return;
        setGraph(g);
        setLaidOutNodes(computeForceLayout(g.nodes, g.edges));
        setGame(initGameState(g.start));
      })
      .catch(() => {
        if (!cancelled) setLoadError("Couldn't load the graph. Check your connection and try again.");
      });
    return () => { cancelled = true; };
  }, [round, mode]);

  // ── Live mode: receive rounds pushed by the server over Socket.io ─
  useEffect(() => {
    if (mode !== "live") return;
    setLoadError(null);

    const applyRound = (data: ServerGraph & { round: number }) => {
      setGraph(data);
      setLaidOutNodes(computeForceLayout(data.nodes, data.edges));
      setGame(initGameState(data.start));
      onRoundChange?.(data.round);
    };

    socket.on("match_start", applyRound);
    socket.on("round_data", applyRound);
    socket.on("round_state", applyRound);

    // Covers the race where match_start/round_data fired before this
    // component finished mounting — ask the server to resend current state.
    socket.emit("request_round_state");

    return () => {
      socket.off("match_start", applyRound);
      socket.off("round_data", applyRound);
      socket.off("round_state", applyRound);
    };
  }, [mode, onRoundChange]);

  const labelById = new Map((graph?.nodes ?? []).map((n) => [n.id, n.label]));
  const labelOf = (id: string) => labelById.get(id) ?? id;

  // Client still computes the optimal path JUST for the "Show optimal
  // path" hint UI — actual move validation always goes through the
  // server (see handlePick), so this can't be used to cheat.
  const { prev: optPrev } = graph
    ? dijkstra(graph.start, graph.nodes, graph.edges)
    : { prev: new Map() };
  const optimalPath = graph ? buildOptimalPath(graph.target, optPrev) : [];
  const adjacency   = graph ? buildAdjacency(graph.edges) : new Map();

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const neighbors = game
    ? (adjacency.get(game.currentNode) ?? []).filter((n) => !game.visitedNodes.has(n.id))
    : [];

  const handlePick = useCallback((nextId: string) => {
    if (!game || !graph || game.won || validating) return;

    const key = edgeKey(game.currentNode, nextId);
    setValidating(true);

    if (mode === "live") {
      socket.emit("submit_step", { currentNode: game.currentNode, chosenNode: nextId });
      socket.once("step_result", ({ correct, isComplete }: { correct: boolean; isComplete: boolean }) => {
        setValidating(false);
        if (!correct) {
          setFlashEdge(key);
          setTimeout(() => setFlashEdge(null), 500);
          return;
        }
        setGame((prev) => {
          if (!prev) return prev;
          const newVisited = new Set(prev.visitedNodes).add(nextId);
          const newEdges   = new Map(prev.traveledEdges);
          newEdges.set(key, "traveled");
          const newPath = [...prev.path, nextId];
          if (isComplete) {
            onWin?.(seconds + 1);
            onRoundComplete?.({ correctActions: newPath.length - 1, totalActions: newPath.length - 1 });
          }
          // won stays false here — the server pushes the next round via
          // "round_data" shortly, which resets the board automatically.
          return { currentNode: nextId, visitedNodes: newVisited, traveledEdges: newEdges, path: newPath, won: false };
        });
      });
      return;
    }

    // ── Solo mode: REST validation ────────────────────────────────
    validateStep(graph.graphId!, game.currentNode, nextId)
      .then(({ correct, isComplete }) => {
        if (!correct) {
          setFlashEdge(key);
          setTimeout(() => setFlashEdge(null), 500);
          return;
        }
        setGame((prev) => {
          if (!prev) return prev;
          const newVisited = new Set(prev.visitedNodes).add(nextId);
          const newEdges   = new Map(prev.traveledEdges);
          newEdges.set(key, "traveled");
          const newPath = [...prev.path, nextId];
          if (isComplete) {
            setRunning(false);
            onWin?.(seconds + 1);
            onRoundComplete?.({ correctActions: newPath.length - 1, totalActions: optimalPath.length - 1 });
          }
          return { currentNode: nextId, visitedNodes: newVisited, traveledEdges: newEdges, path: newPath, won: isComplete };
        });
      })
      .catch(() => setLoadError("Couldn't validate that move. Check your connection."))
      .finally(() => setValidating(false));
  }, [game, graph, validating, seconds, onWin, onRoundComplete, optimalPath.length, mode]);

  const handleReset = useCallback(() => {
    if (!graph) return;
    setGame(initGameState(graph.start));
    setSeconds(0);
    setRunning(true);
    setFlashEdge(null);
    onReset?.();
  }, [onReset, graph]);

  // ── D3 render ────────────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current || !graph || !game) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const defs = svg.append("defs");
    const makeGlow = (id: string, color: string, stdDev: number) => {
      const f = defs.append("filter").attr("id", id)
        .attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%");
      f.append("feGaussianBlur").attr("in", "SourceGraphic").attr("stdDeviation", stdDev).attr("result", "blur");
      f.append("feFlood").attr("flood-color", color).attr("flood-opacity", 0.8).attr("result", "color");
      f.append("feComposite").attr("in", "color").attr("in2", "blur").attr("operator", "in").attr("result", "glow");
      const m = f.append("feMerge");
      m.append("feMergeNode").attr("in", "glow");
      m.append("feMergeNode").attr("in", "SourceGraphic");
    };
    makeGlow("dij-glow-node", C.node, 5);
    makeGlow("dij-glow-gold", C.gold, 8);
    makeGlow("dij-glow-teal", C.teal, 6);

    const nodeMap = new Map(laidOutNodes.map((n) => [n.id, n]));

    const edgeGroup = svg.append("g");
    graph.edges.forEach((e) => {
      const src = nodeMap.get(e.source)!;
      const tgt = nodeMap.get(e.target)!;
      const key = edgeKey(e.source, e.target);
      const state: EdgeState = flashEdge === key ? "error" : game.traveledEdges.get(key) ?? "default";
      const stroke  = state === "traveled" ? C.teal : state === "error" ? C.error : C.panelBorder;
      const strokeW = state !== "default" ? 2.5 : 1.5;
      const opacity = state !== "default" ? 1 : 0.55;
      edgeGroup.append("line")
        .attr("x1", src.x).attr("y1", src.y).attr("x2", tgt.x).attr("y2", tgt.y)
        .attr("stroke", stroke).attr("stroke-width", strokeW).attr("opacity", opacity)
        .attr("stroke-linecap", "round");
      const mx = (src.x + tgt.x) / 2;
      const my = (src.y + tgt.y) / 2;
      edgeGroup.append("text")
        .attr("x", mx).attr("y", my - 5).attr("text-anchor", "middle")
        .attr("fill", state === "traveled" ? C.teal : C.textMuted)
        .attr("font-size", "11px").attr("font-family", "JetBrains Mono, monospace")
        .attr("pointer-events", "none").text(e.weight);
    });

    const nodeGroup = svg.append("g");
    laidOutNodes.forEach((n) => {
      const isStart   = n.id === graph.start;
      const isTarget  = n.id === graph.target;
      const isCurrent = n.id === game.currentNode;
      const isVisited = game.visitedNodes.has(n.id);
      const isSelectable = !game.won && adjacency.get(game.currentNode)?.some(
        (nb) => nb.id === n.id && !game.visitedNodes.has(n.id)
      );
      const fill   = isTarget ? C.gold : isVisited ? C.teal : C.node;
      const filter = isTarget ? "url(#dij-glow-gold)" : isCurrent || isVisited ? "url(#dij-glow-teal)" : "url(#dij-glow-node)";
      const r = isCurrent ? 18 : 15;
      const g = nodeGroup.append("g").attr("transform", `translate(${n.x},${n.y})`);

      if (isStart) {
        g.append("circle").attr("r", 21).attr("fill", "none")
          .attr("stroke", C.node).attr("stroke-width", 1).attr("opacity", 0.4);
      }
      if (isTarget) {
        g.append("circle").attr("r", 23).attr("fill", "none")
          .attr("stroke", C.gold).attr("stroke-width", 1.5).attr("opacity", 0.5)
          .attr("stroke-dasharray", "4 3");
      }
      if (isSelectable) {
        g.append("circle")
          .attr("r", r + 4)
          .attr("fill", "none")
          .attr("stroke", C.gold)
          .attr("stroke-width", 1.5)
          .attr("opacity", 0.55)
          .attr("class", "dij-selectable-ring");
      }

      g.append("circle").attr("r", r).attr("fill", fill)
        .attr("opacity", isVisited || isTarget || isCurrent ? 1 : 0.75).attr("filter", filter);
      g.append("circle").attr("r", r - 4).attr("fill", C.panel).attr("opacity", 0.55);
      g.append("text")
        .attr("text-anchor", "middle").attr("dominant-baseline", "central")
        .attr("fill", isTarget ? C.gold : isVisited ? C.teal : C.textPrimary)
        .attr("font-size", "13px").attr("font-weight", "600")
        .attr("font-family", "JetBrains Mono, monospace").attr("pointer-events", "none")
        .text(n.label);

      if (isSelectable) {
        g.append("circle")
          .attr("r", 26)
          .attr("fill", "transparent")
          .attr("cursor", "pointer")
          .on("click", () => handlePick(n.id))
          .on("mouseenter", function () {
            d3.select(this.parentNode as Element).select(".dij-selectable-ring")
              .transition().duration(150).attr("r", r + 7).attr("opacity", 0.9);
          })
          .on("mouseleave", function () {
            d3.select(this.parentNode as Element).select(".dij-selectable-ring")
              .transition().duration(150).attr("r", r + 4).attr("opacity", 0.55);
          });
      }

      if (isCurrent && !game.won) {
        g.append("circle")
          .attr("r", r + 6)
          .attr("fill", "none")
          .attr("stroke", C.teal)
          .attr("stroke-width", 1)
          .attr("opacity", 0.5)
          .append("animate")
          .attr("attributeName", "r")
          .attr("values", `${r + 4};${r + 10};${r + 4}`)
          .attr("dur", "1.6s")
          .attr("repeatCount", "indefinite");
      }
    });
  }, [game, flashEdge, graph, laidOutNodes, adjacency, handlePick]);

  const weightTo = (neighborId: string): number => {
    if (!graph || !game) return 0;
    const e = graph.edges.find(
      (ed) => (ed.source === game.currentNode && ed.target === neighborId) ||
              (ed.target === game.currentNode && ed.source === neighborId)
    );
    return e?.weight ?? 0;
  };

  // ── Guards ───────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <p className="text-sm text-error">{loadError}</p>
        <Button variant="secondary" onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  if (!graph || !game) {
    return (
      <div className="flex items-center justify-center py-24">
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 1.4 }}
          className="font-mono text-sm text-textMuted"
        >
          Loading graph…
        </motion.div>
      </div>
    );
  }

  if (game.won && !onRoundComplete) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6 py-16 text-center"
        >
          <CheckCircle2 size={56} className="text-teal drop-shadow-[0_0_12px_#6EE7C4]" aria-hidden="true" />
          <div>
            <h2 className="font-sans text-2xl font-bold text-textPrimary">Path found!</h2>
            <p className="mt-1 text-sm text-textMuted">
              You reached <span className="font-mono text-gold">T</span> in{" "}
              <span className="font-mono text-teal">{game.path.map(labelOf).join(" → ")}</span>
            </p>
          </div>
          <Button variant="secondary" onClick={handleReset} className="gap-2">
            <RotateCcw size={14} aria-hidden="true" /> Play again
          </Button>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── Main board ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex items-center flex-wrap gap-1 rounded-lg border border-panelBorder bg-panel/60 px-4 py-2.5"
        aria-label="Current path"
        aria-live="polite"
      >
        <span className="text-xs text-textMuted mr-1 shrink-0">Path:</span>
        {game.path.map((nodeId, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className={`font-mono text-sm font-semibold ${
              nodeId === graph.target ? "text-gold" : nodeId === graph.start ? "text-node" : "text-teal"
            }`}>{labelOf(nodeId)}</span>
            {i < game.path.length - 1 && (
              <ChevronRight size={12} className="text-textMuted" aria-hidden="true" />
            )}
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <Card className="flex-1 min-w-0 !p-3 overflow-hidden">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            className="w-full h-auto"
            aria-label="Dijkstra graph visualisation"
            role="img"
          />
        </Card>

        <div className="w-full lg:w-64 shrink-0 flex flex-col gap-4">
          <Card className="flex flex-col gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-textMuted mb-1">Current node</p>
              <span className="font-mono text-3xl font-bold text-node">{labelOf(game.currentNode)}</span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-textMuted mb-2">Available moves</p>
              <p className="text-[11px] text-textMuted mb-2 italic">Click a glowing node on the graph to move.</p>
              {neighbors.length === 0 ? (
                <p className="text-xs text-textMuted italic">
                  No unvisited neighbors — reset to try again.
                </p>
              ) : (
                <ul className="flex flex-col gap-2" role="list">
                  {neighbors.map((nb) => (
                    <li
                      key={nb.id}
                      className="w-full flex items-center justify-between rounded-lg border border-panelBorder bg-background/40 px-3 py-2"
                    >
                      <span className="font-mono text-sm font-semibold text-textPrimary">{labelOf(nb.id)}</span>
                      <span className="font-mono text-xs text-textMuted">w: {weightTo(nb.id)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <details className="group">
              <summary className="cursor-pointer text-xs text-textMuted hover:text-textPrimary transition-colors list-none flex items-center gap-1">
                <ChevronRight size={12} className="group-open:rotate-90 transition-transform" aria-hidden="true" />
                Show optimal path
              </summary>
              <p className="mt-2 font-mono text-xs text-teal break-all">
                {optimalPath.map(labelOf).join(" → ")}
              </p>
            </details>
          </Card>

          <Card className="!p-4 flex flex-col gap-2">
            <p className="text-xs uppercase tracking-widest text-textMuted mb-1">Legend</p>
            {[
              { color: "bg-node",        label: "Unvisited node"  },
              { color: "bg-teal",        label: "Visited node"    },
              { color: "bg-gold",        label: "Target node (T)" },
              { color: "bg-panelBorder", label: "Unvisited edge"  },
              { color: "bg-teal",        label: "Traveled edge"   },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2">
                <span className={`inline-block w-3 h-3 rounded-full ${color} shrink-0`} aria-hidden="true" />
                <span className="text-xs text-textMuted">{label}</span>
              </div>
            ))}
          </Card>

          <Button variant="secondary" onClick={handleReset} className="gap-1.5 !px-3 !py-1.5 text-xs w-full justify-center">
            <RotateCcw size={13} aria-hidden="true" /> Reset
          </Button>
        </div>
      </div>
    </div>
  );
}