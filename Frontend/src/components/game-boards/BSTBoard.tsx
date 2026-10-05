/**
 * BSTBoard.tsx
 *
 * Core gameplay UI for BST Builder.
 * Renders the chip queue and D3 tree canvas with drag-and-drop.
 *
 * What is NOT here (belongs in the page wrapper):
 *  - Page heading / description
 *  - Page-level score display in header
 */

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useEffect,
} from "react";
import * as d3 from "d3";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, RotateCcw, TreePine } from "lucide-react";
import Card from "../ui/Card";
import Button from "../ui/Button";

// ─── Theme ────────────────────────────────────────────────────────────────────
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

// ─── Mock question data ───────────────────────────────────────────────────────
const QUESTION_SETS: number[][] = [
  [50, 30, 70, 20, 40, 60, 80],
  [45, 25, 65, 15, 35, 55, 75],
  [10, 50, 30, 70, 20, 60],
];

function pickQuestion(): number[] {
  return QUESTION_SETS[Math.floor(Math.random() * QUESTION_SETS.length)];
}

// ─── BST types & helpers ──────────────────────────────────────────────────────
interface BSTNode {
  value: number;
  left:  BSTNode | null;
  right: BSTNode | null;
}

function bstInsert(root: BSTNode | null, value: number): BSTNode {
  if (!root) return { value, left: null, right: null };
  if (value < root.value) return { ...root, left:  bstInsert(root.left,  value) };
  if (value > root.value) return { ...root, right: bstInsert(root.right, value) };
  return root;
}

function isValidPlacement(
  root: BSTNode | null,
  parentValue: number,
  side: "left" | "right",
  value: number
): boolean {
  if (!root) return false;
  if (root.value === parentValue) {
    if (side === "left")  return value < root.value && root.left  === null;
    if (side === "right") return value > root.value && root.right === null;
  }
  return (
    isValidPlacement(root.left,  parentValue, side, value) ||
    isValidPlacement(root.right, parentValue, side, value)
  );
}

function toD3Hierarchy(root: BSTNode) {
  return d3.hierarchy(root, (d) => {
    const children: BSTNode[] = [];
    if (d.left)  children.push(d.left);
    if (d.right) children.push(d.right);
    return children.length ? children : null;
  });
}

interface SlotInfo {
  parentValue: number;
  side: "left" | "right";
  x: number;
  y: number;
}

const SVG_W  = 560;
const SVG_H  = 380;
const NODE_R = 22;
const LEVEL_H = 80;

// ─── Props ────────────────────────────────────────────────────────────────────
export interface BSTBoardProps {
  onWin?:   (score: number) => void;
  onReset?: () => void;
  /**
   * When provided the board is running inside GameSessionShell.
   * Shell controls round transitions; the board's own success overlay
   * is suppressed.
   *
   * correctActions = numbers correctly placed this round
   * totalActions   = total numbers to place (excluding auto-placed root)
   */
  onRoundComplete?: (payload: { correctActions: number; totalActions: number }) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function BSTBoard({ onWin, onReset, onRoundComplete }: BSTBoardProps) {
  const [numbers, setNumbers]   = useState<number[]>(() => pickQuestion());
  const [queue,   setQueue]     = useState<number[]>(() => [...numbers]);
  const [placed,  setPlaced]    = useState<number[]>([]);
  const [tree,    setTree]      = useState<BSTNode | null>(null);
  const [score,   setScore]     = useState(0);
  const [won,     setWon]       = useState(false);

  const [dragging,    setDragging]    = useState<number | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<SlotInfo | null>(null);
  const [pulseNode,   setPulseNode]   = useState<number | null>(null);
  const [errorSlot,   setErrorSlot]   = useState<SlotInfo | null>(null);

  const svgRef     = useRef<SVGSVGElement>(null);
  const slotsRef   = useRef<SlotInfo[]>([]);
  const dragValRef = useRef<number | null>(null);

  const handleReset = useCallback(() => {
    const q = pickQuestion();
    setNumbers(q);
    setQueue([...q]);
    setPlaced([]);
    setTree(null);
    setScore(0);
    setWon(false);
    setDragging(null);
    setHoveredSlot(null);
    setPulseNode(null);
    setErrorSlot(null);
    onReset?.();
  }, [onReset]);

  // Auto-place root
  useEffect(() => {
    if (queue.length === numbers.length && queue.length > 0) {
      const root = queue[0];
      setTree(bstInsert(null, root));
      setPlaced([root]);
      setQueue((q) => q.slice(1));
    }
  }, [numbers]);

  function computeSlots(root: BSTNode | null): SlotInfo[] {
    if (!root) return [];
    const slots: SlotInfo[] = [];
    const hier = toD3Hierarchy(root);
    const treeLayout = d3.tree<BSTNode>().nodeSize([52, LEVEL_H]);
    treeLayout(hier as d3.HierarchyNode<BSTNode>);
    const nodes = (hier as any).descendants() as any[];
    const minX = Math.min(...nodes.map((n: any) => n.x));
    const maxX = Math.max(...nodes.map((n: any) => n.x));
    const offsetX = SVG_W / 2 - (minX + maxX) / 2;
    const offsetY = 50;
    hier.each((n: any) => {
      const d = n.data as BSTNode;
      const nx = n.x + offsetX;
      const ny = n.y + offsetY;
      if (!d.left)  slots.push({ parentValue: d.value, side: "left",  x: nx - 40, y: ny + LEVEL_H });
      if (!d.right) slots.push({ parentValue: d.value, side: "right", x: nx + 40, y: ny + LEVEL_H });
    });
    return slots;
  }

  useLayoutEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const defs = svg.append("defs");
    const makeGlow = (id: string, color: string, dev: number) => {
      const f = defs.append("filter").attr("id", id)
        .attr("x", "-60%").attr("y", "-60%").attr("width", "220%").attr("height", "220%");
      f.append("feGaussianBlur").attr("in", "SourceGraphic").attr("stdDeviation", dev).attr("result", "blur");
      f.append("feFlood").attr("flood-color", color).attr("flood-opacity", 0.85).attr("result", "color");
      f.append("feComposite").attr("in", "color").attr("in2", "blur").attr("operator", "in").attr("result", "glow");
      const m = f.append("feMerge");
      m.append("feMergeNode").attr("in", "glow");
      m.append("feMergeNode").attr("in", "SourceGraphic");
    };
    makeGlow("bst-glow-node", C.node, 5);
    makeGlow("bst-glow-teal", C.teal, 7);
    makeGlow("bst-glow-gold", C.gold, 7);
    makeGlow("bst-glow-err",  C.error, 5);

    if (!tree) return;

    const hier = toD3Hierarchy(tree);
    const treeLayout = d3.tree<BSTNode>().nodeSize([52, LEVEL_H]);
    treeLayout(hier as d3.HierarchyNode<BSTNode>);
    const allNodes = (hier as any).descendants() as any[];
    const minX = Math.min(...allNodes.map((n: any) => n.x));
    const maxX = Math.max(...allNodes.map((n: any) => n.x));
    const offsetX = SVG_W / 2 - (minX + maxX) / 2;
    const offsetY = 50;

    const linkGroup = svg.append("g");
    hier.links().forEach((link: any) => {
      linkGroup.append("line")
        .attr("x1", link.source.x + offsetX).attr("y1", link.source.y + offsetY)
        .attr("x2", link.target.x + offsetX).attr("y2", link.target.y + offsetY)
        .attr("stroke", C.panelBorder).attr("stroke-width", 1.5)
        .attr("opacity", 0.7).attr("stroke-linecap", "round");
    });

    const nodeGroup = svg.append("g");
    allNodes.forEach((n: any) => {
      const d = n.data as BSTNode;
      const nx = n.x + offsetX;
      const ny = n.y + offsetY;
      const isPulse = d.value === pulseNode;
      const isRoot  = n.parent === null;
      const gFilter = isPulse ? "url(#bst-glow-teal)" : isRoot ? "url(#bst-glow-gold)" : "url(#bst-glow-node)";
      const fill    = isPulse ? C.teal : isRoot ? C.gold : C.node;

      const g = nodeGroup.append("g").attr("transform", `translate(${nx},${ny})`);
      if (isRoot) {
        g.append("circle").attr("r", NODE_R + 5).attr("fill", "none")
          .attr("stroke", C.gold).attr("stroke-width", 1).attr("opacity", 0.4)
          .attr("stroke-dasharray", "4 3");
      }
      g.append("circle").attr("r", NODE_R).attr("fill", fill).attr("filter", gFilter).attr("opacity", isPulse ? 1 : 0.9);
      g.append("circle").attr("r", NODE_R - 5).attr("fill", C.panel).attr("opacity", 0.5);
      g.append("text")
        .attr("text-anchor", "middle").attr("dominant-baseline", "central")
        .attr("fill", isPulse ? C.teal : isRoot ? C.gold : C.textPrimary)
        .attr("font-size", "12px").attr("font-weight", "700")
        .attr("font-family", "JetBrains Mono, monospace").attr("pointer-events", "none")
        .text(d.value);
    });

    const slots = computeSlots(tree);
    slotsRef.current = slots;
    const slotGroup = svg.append("g");
    slots.forEach((slot) => {
      const isHovered = hoveredSlot?.parentValue === slot.parentValue && hoveredSlot?.side === slot.side;
      const isError   = errorSlot?.parentValue === slot.parentValue   && errorSlot?.side === slot.side;
      const stroke  = isError ? C.error : isHovered ? C.gold : C.panelBorder;
      const filter  = isHovered ? "url(#bst-glow-gold)" : isError ? "url(#bst-glow-err)" : "none";
      const opacity = isHovered || isError ? 0.9 : 0.35;
      slotGroup.append("circle")
        .attr("cx", slot.x).attr("cy", slot.y).attr("r", NODE_R - 4)
        .attr("fill", "none").attr("stroke", stroke)
        .attr("stroke-width", isHovered || isError ? 2 : 1)
        .attr("stroke-dasharray", isHovered || isError ? "none" : "4 3")
        .attr("opacity", opacity).attr("filter", filter);
      slotGroup.append("text")
        .attr("x", slot.x).attr("y", slot.y)
        .attr("text-anchor", "middle").attr("dominant-baseline", "central")
        .attr("fill", isHovered ? C.gold : C.textMuted)
        .attr("font-size", "10px").attr("font-family", "JetBrains Mono, monospace")
        .attr("pointer-events", "none").attr("opacity", opacity)
        .text(slot.side === "left" ? "L" : "R");
    });
  }, [tree, hoveredSlot, errorSlot, pulseNode]);

  const handleChipDragStart = (e: React.DragEvent<HTMLDivElement>, value: number) => {
    dragValRef.current = value;
    setDragging(value);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(value));
  };

  const handleChipDragEnd = () => {
    setDragging(null);
    dragValRef.current = null;
    setHoveredSlot(null);
  };

  const handleSvgDragOver = (e: React.DragEvent<SVGSVGElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const rect  = svgEl.getBoundingClientRect();
    const scaleX = SVG_W / rect.width;
    const scaleY = SVG_H / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top)  * scaleY;
    const SNAP = 40;
    let closest: SlotInfo | null = null;
    let minDist = Infinity;
    for (const slot of slotsRef.current) {
      const dist = Math.hypot(px - slot.x, py - slot.y);
      if (dist < SNAP && dist < minDist) { minDist = dist; closest = slot; }
    }
    setHoveredSlot(closest);
  };

  const handleSvgDragLeave = () => setHoveredSlot(null);

  const handleSvgDrop = (e: React.DragEvent<SVGSVGElement>) => {
    e.preventDefault();
    const value = dragValRef.current ?? Number(e.dataTransfer.getData("text/plain"));
    if (!hoveredSlot || isNaN(value)) { setHoveredSlot(null); return; }

    const valid = isValidPlacement(tree, hoveredSlot.parentValue, hoveredSlot.side, value);

    if (valid) {
      const newTree = bstInsert(tree, value);
      setTree(newTree);
      setPlaced((p) => [...p, value]);
      setQueue((q) => q.filter((n) => n !== value));
      const newScore = score + 10;
      setScore(newScore);
      setPulseNode(value);
      setTimeout(() => setPulseNode(null), 800);
      const remaining = queue.filter((n) => n !== value);
      if (remaining.length === 0) {
        setWon(true);
        onWin?.(newScore);
        onRoundComplete?.({
          correctActions: placed.length, // all placements in this round were valid
          totalActions:   total,
        });
      }
    } else {
      setErrorSlot(hoveredSlot);
      setTimeout(() => setErrorSlot(null), 600);
    }
    setHoveredSlot(null);
    setDragging(null);
    dragValRef.current = null;
  };

  const total = numbers.length - 1;

  return (
    <div className="flex flex-col gap-6">
      {/* Score strip */}
      <Card className="!p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <TreePine size={16} className="text-teal" aria-hidden="true" />
          <span className="text-sm text-textMuted">Numbers placed:</span>
          <span className="font-mono text-sm font-bold text-textPrimary">
            {placed.length - 1} <span className="text-textMuted font-normal">/ {total}</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-textMuted">Score:</span>
            <span className="font-mono text-lg font-bold text-gold">{score}</span>
          </div>
          <Button variant="secondary" onClick={handleReset} className="gap-1.5 !px-3 !py-1.5 text-xs shrink-0">
            <RotateCcw size={13} aria-hidden="true" /> Reset
          </Button>
        </div>
      </Card>

      {/* Chip queue */}
      <div>
        <p className="text-xs uppercase tracking-widest text-textMuted mb-3">
          Drag a number onto a slot
        </p>
        <div className="flex flex-wrap gap-3" role="list" aria-label="Numbers to place">
          {queue.map((value) => (
            <motion.div
              key={value}
              role="listitem"
              draggable
              onDragStart={(e) => handleChipDragStart(e as any, value)}
              onDragEnd={handleChipDragEnd}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              animate={dragging === value ? { opacity: 0.4, scale: 0.92 } : { opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 380, damping: 22 }}
              className="flex h-12 w-12 cursor-grab active:cursor-grabbing select-none items-center justify-center rounded-full border border-node bg-panel font-mono text-sm font-bold text-node shadow-[0_0_0_2px_#7FA8FF30,0_0_10px_2px_#7FA8FF30] hover:border-gold hover:text-gold hover:shadow-[0_0_0_2px_#FFD36E30,0_0_12px_3px_#FFD36E30] transition-colors duration-200"
              aria-label={`Number chip: ${value}`}
            >
              {value}
            </motion.div>
          ))}
          {queue.length === 0 && !won && (
            <span className="text-sm text-textMuted italic">All numbers placed!</span>
          )}
        </div>
      </div>

      {/* Tree canvas */}
      <Card className="!p-2 overflow-hidden">
        {tree ? (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            className="w-full h-auto"
            aria-label="Binary search tree visualisation"
            role="img"
            onDragOver={handleSvgDragOver}
            onDragLeave={handleSvgDragLeave}
            onDrop={handleSvgDrop}
          />
        ) : (
          <div className="flex h-64 w-full items-center justify-center">
            <p className="text-sm text-textMuted">Place the first number to start the tree</p>
          </div>
        )}
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-textMuted">
        {[
          { color: "bg-gold", label: "Root node"    },
          { color: "bg-node", label: "Inserted node" },
          { color: "bg-teal", label: "Just placed"   },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded-full ${color}`} aria-hidden="true" />
            {label}
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="inline-flex h-3 w-3 items-center justify-center rounded-full border border-dashed border-textMuted text-[7px] font-bold" aria-hidden="true">L</span>
          Drop slot (left / right)
        </div>
      </div>

      {/* Success overlay — suppressed when shell drives round transitions */}
      <AnimatePresence>
        {won && !onRoundComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 24 }}
            animate={{ opacity: 1, scale: 1,   y: 0  }}
            exit={{    opacity: 0, scale: 0.9, y: 24  }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bst-success-title"
          >
            <Card
              className="w-full max-w-sm text-center flex flex-col items-center gap-5"
              style={{
                border: `2px solid ${C.teal}`,
                boxShadow: `0 0 0 2px rgba(110,231,196,0.2), 0 0 32px 8px rgba(110,231,196,0.15)`,
              }}
            >
              <CheckCircle2 size={48} className="text-teal" aria-hidden="true" />
              <div>
                <h2 id="bst-success-title" className="font-sans text-xl font-bold text-textPrimary">
                  Valid BST Built!
                </h2>
                <p className="mt-2 text-sm text-textMuted">
                  You placed all <span className="font-mono font-semibold text-textPrimary">{total}</span> numbers correctly.
                </p>
                <p className="mt-1 text-sm text-textMuted">
                  Final score: <span className="font-mono font-bold text-gold">{score}</span>
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
