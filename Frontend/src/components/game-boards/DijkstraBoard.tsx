/**
 * DijkstraBoard.tsx
 *
 * Core gameplay UI for Dijkstra's Adventure.
 * Renders the D3 graph canvas + neighbour-picker step panel.
 *
 * Props
 * ─────
 *  onWin(seconds)  — called when the player reaches the target node
 *  onReset()       — called when the player hits Reset (parent resets timer etc.)
 *  externalSeconds — optional controlled timer value supplied by a parent wrapper;
 *                    when omitted the board manages its own timer internally.
 *
 * What is NOT here (belongs in the page wrapper):
 *  - Page heading / description
 *  - Timer display
 *  - Reset button in the header area
 */

import { useCallback, useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, CheckCircle2 } from "lucide-react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { RotateCcw } from "lucide-react";

// ─── Theme constants ──────────────────────────────────────────────────────────
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

// ─── Graph data ───────────────────────────────────────────────────────────────
interface GraphNode { id: string; label: string; x: number; y: number; }
interface GraphEdge { source: string; target: string; weight: number; }

const NODES: GraphNode[] = [
  { id: "S", label: "S", x:  60, y: 170 },
  { id: "A", label: "A", x: 170, y:  60 },
  { id: "B", label: "B", x: 170, y: 280 },
  { id: "C", label: "C", x: 290, y: 130 },
  { id: "D", label: "D", x: 290, y: 240 },
  { id: "E", label: "E", x: 400, y:  60 },
  { id: "F", label: "F", x: 400, y: 210 },
  { id: "T", label: "T", x: 490, y: 135 },
];

const EDGES: GraphEdge[] = [
  { source: "S", target: "A", weight: 4 },
  { source: "S", target: "B", weight: 2 },
  { source: "A", target: "C", weight: 3 },
  { source: "A", target: "E", weight: 5 },
  { source: "B", target: "D", weight: 4 },
  { source: "B", target: "C", weight: 6 },
  { source: "C", target: "E", weight: 2 },
  { source: "C", target: "F", weight: 1 },
  { source: "D", target: "F", weight: 3 },
  { source: "E", target: "T", weight: 3 },
  { source: "F", target: "T", weight: 5 },
];

const START_NODE  = "S";
const TARGET_NODE = "T";

// ─── Dijkstra precompute ──────────────────────────────────────────────────────
function buildAdjacency(edges: GraphEdge[]) {
  const adj = new Map<string, { id: string; weight: number }[]>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    if (!adj.has(e.target)) adj.set(e.target, []);
    adj.get(e.source)!.push({ id: e.target, weight: e.weight });
    adj.get(e.target)!.push({ id: e.source, weight: e.weight });
  }
  return adj;
}

function dijkstra(start: string, nodes: GraphNode[], edges: GraphEdge[]) {
  const adj  = buildAdjacency(edges);
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

function initGameState(): GameState {
  return {
    currentNode:   START_NODE,
    visitedNodes:  new Set([START_NODE]),
    traveledEdges: new Map(),
    path:          [START_NODE],
    won:           false,
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────
export interface DijkstraBoardProps {
  /** Called with the final elapsed seconds when the player wins */
  onWin?: (seconds: number) => void;
  /** Called when the player clicks Reset */
  onReset?: () => void;
  /**
   * When provided the board is running inside GameSessionShell.
   * The shell calls this to advance the round counter; the board's own
   * success overlay is suppressed so the shell controls round transitions.
   *
   * payload.correctActions = number of edges on the optimal path taken
   * payload.totalActions   = total edges on the optimal path
   */
  onRoundComplete?: (payload: { correctActions: number; totalActions: number }) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function DijkstraBoard({ onWin, onReset, onRoundComplete }: DijkstraBoardProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [game,      setGame]      = useState<GameState>(initGameState);
  const [seconds,   setSeconds]   = useState(0);
  const [running,   setRunning]   = useState(true);
  const [flashEdge, setFlashEdge] = useState<string | null>(null);

  const { prev: optPrev } = dijkstra(START_NODE, NODES, EDGES);
  const optimalPath = buildOptimalPath(TARGET_NODE, optPrev);
  const adjacency   = buildAdjacency(EDGES);

  // ── Internal timer ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const neighbors = (adjacency.get(game.currentNode) ?? []).filter(
    (n) => !game.visitedNodes.has(n.id)
  );

  const handlePick = useCallback((nextId: string) => {
    if (game.won) return;
    const key = edgeKey(game.currentNode, nextId);
    setGame((prev) => {
      const newVisited = new Set(prev.visitedNodes).add(nextId);
      const newEdges   = new Map(prev.traveledEdges);
      newEdges.set(key, "traveled");
      const newPath = [...prev.path, nextId];
      const won     = nextId === TARGET_NODE;
      if (won) {
        setRunning(false);
        onWin?.(seconds + 1);
        // When running inside the session shell, fire onRoundComplete instead
        // of showing the board's own overlay (shell drives round transitions).
        if (onRoundComplete) {
          // correctActions = edges on the player's actual path (nodes - 1)
          // totalActions   = edges on the optimal path (optimalPath nodes - 1)
          onRoundComplete({
            correctActions: newPath.length - 1,
            totalActions:   optimalPath.length - 1,
          });
        }
      }
      return { currentNode: nextId, visitedNodes: newVisited, traveledEdges: newEdges, path: newPath, won };
    });
  }, [game, seconds, onWin]);

  const handleReset = useCallback(() => {
    setGame(initGameState());
    setSeconds(0);
    setRunning(true);
    setFlashEdge(null);
    onReset?.();
  }, [onReset]);

  // ── D3 render ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current) return;
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

    const nodeMap = new Map(NODES.map((n) => [n.id, n]));

    // Edges
    const edgeGroup = svg.append("g");
    EDGES.forEach((e) => {
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

    // Nodes
    const nodeGroup = svg.append("g");
    NODES.forEach((n) => {
      const isStart   = n.id === START_NODE;
      const isTarget  = n.id === TARGET_NODE;
      const isCurrent = n.id === game.currentNode;
      const isVisited = game.visitedNodes.has(n.id);
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
      g.append("circle").attr("r", r).attr("fill", fill)
        .attr("opacity", isVisited || isTarget || isCurrent ? 1 : 0.75).attr("filter", filter);
      g.append("circle").attr("r", r - 4).attr("fill", C.panel).attr("opacity", 0.55);
      g.append("text")
        .attr("text-anchor", "middle").attr("dominant-baseline", "central")
        .attr("fill", isTarget ? C.gold : isVisited ? C.teal : C.textPrimary)
        .attr("font-size", "13px").attr("font-weight", "600")
        .attr("font-family", "JetBrains Mono, monospace").attr("pointer-events", "none")
        .text(n.label);
    });
  }, [game, flashEdge]);

  const weightTo = (neighborId: string): number => {
    const e = EDGES.find(
      (ed) => (ed.source === game.currentNode && ed.target === neighborId) ||
              (ed.target === game.currentNode && ed.source === neighborId)
    );
    return e?.weight ?? 0;
  };

  // ── Win overlay (suppressed when shell is driving round transitions) ──────
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
              <span className="font-mono text-teal">{game.path.join(" → ")}</span>
            </p>
          </div>
          <Button variant="secondary" onClick={handleReset} className="gap-2">
            <RotateCcw size={14} aria-hidden="true" /> Play again
          </Button>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── Main board ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {/* Path trail */}
      <div
        className="flex items-center flex-wrap gap-1 rounded-lg border border-panelBorder bg-panel/60 px-4 py-2.5"
        aria-label="Current path"
        aria-live="polite"
      >
        <span className="text-xs text-textMuted mr-1 shrink-0">Path:</span>
        {game.path.map((nodeId, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className={`font-mono text-sm font-semibold ${
              nodeId === TARGET_NODE ? "text-gold" : nodeId === START_NODE ? "text-node" : "text-teal"
            }`}>{nodeId}</span>
            {i < game.path.length - 1 && (
              <ChevronRight size={12} className="text-textMuted" aria-hidden="true" />
            )}
          </span>
        ))}
      </div>

      {/* Graph + step panel */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Graph SVG */}
        <Card className="flex-1 min-w-0 !p-3 overflow-hidden">
          <svg
            ref={svgRef}
            viewBox="0 0 520 340"
            className="w-full h-auto"
            aria-label="Dijkstra graph visualisation"
            role="img"
          />
        </Card>

        {/* Step panel */}
        <div className="w-full lg:w-64 shrink-0 flex flex-col gap-4">
          <Card className="flex flex-col gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-textMuted mb-1">Current node</p>
              <span className="font-mono text-3xl font-bold text-node">{game.currentNode}</span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-textMuted mb-2">Choose next node</p>
              {neighbors.length === 0 ? (
                <p className="text-xs text-textMuted italic">
                  No unvisited neighbors — reset to try again.
                </p>
              ) : (
                <ul className="flex flex-col gap-2" role="list">
                  {neighbors.map((nb) => (
                    <li key={nb.id}>
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                        onClick={() => handlePick(nb.id)}
                        className="w-full flex items-center justify-between rounded-lg border border-panelBorder bg-background/60 px-3 py-2 text-left hover:border-node/60 hover:bg-node/5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-node min-h-[44px]"
                        aria-label={`Move to node ${nb.id}, weight ${weightTo(nb.id)}`}
                      >
                        <span className="font-mono text-sm font-semibold text-textPrimary">{nb.id}</span>
                        <span className="font-mono text-xs text-textMuted">w: {weightTo(nb.id)}</span>
                      </motion.button>
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
              <p className="mt-2 font-mono text-xs text-teal break-all">{optimalPath.join(" → ")}</p>
            </details>
          </Card>

          {/* Legend */}
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

          {/* Reset */}
          <Button variant="secondary" onClick={handleReset} className="gap-1.5 !px-3 !py-1.5 text-xs w-full justify-center">
            <RotateCcw size={13} aria-hidden="true" /> Reset
          </Button>
        </div>
      </div>
    </div>
  );
}
