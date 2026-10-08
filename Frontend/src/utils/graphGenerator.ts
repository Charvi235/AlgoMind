/**
 * graphGenerator.ts
 *
 * Shared, reusable graph-generation utilities. Produces a random,
 * fully-connected weighted graph whose size/complexity scales with the
 * round number (progressive difficulty within a 60s session).
 *
 * Used by: DijkstraBoard. Floyd-Warshall can reuse
 * generateConnectedGraph() later instead of writing its own —
 * keep graph-generation logic in ONE place, not duplicated per game.
 */

export interface SimpleNode {
  id: string;
  label: string;
}

export interface SimpleEdge {
  source: string;
  target: string;
  weight: number;
}

export interface GeneratedGraph {
  nodes: SimpleNode[];
  edges: SimpleEdge[];
  start: string;
  target: string;
}

const MIN_WEIGHT = 1;
const MAX_WEIGHT = 15;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Difficulty curve: node count grows with round (capped at 10 so a
 * 60s round stays solvable). Extra edges beyond the spanning tree grow
 * more slowly, so later rounds introduce real alternate-path decisions
 * instead of just a bigger tree.
 */
export function difficultyForRound(round: number) {
  const nodeCount = Math.min(4 + round, 10);
  const extraEdges = Math.min(1 + Math.floor(round / 2), 4);
  return { nodeCount, extraEdges };
}

const edgeKey = (a: string, b: string) => [a, b].sort().join("--");

/**
 * Random CONNECTED undirected weighted graph with `nodeCount` nodes.
 * Connectivity is guaranteed via a random spanning tree (each new node
 * attaches to a RANDOMLY chosen already-placed node — not a fixed
 * one, so the shape differs every call), then a few extra random
 * edges are layered on for alternate-path complexity.
 */
export function generateConnectedGraph(
  nodeCount: number,
  extraEdges: number
): { nodes: SimpleNode[]; edges: SimpleEdge[] } {
  const ids = Array.from({ length: nodeCount }, (_, i) => `n${i}`);
  const order = shuffle(ids);

  const edgeSet = new Map<string, SimpleEdge>();
  for (let i = 1; i < order.length; i++) {
    const child = order[i];
    const parent = order[randomInt(0, i - 1)];
    edgeSet.set(edgeKey(child, parent), {
      source: parent,
      target: child,
      weight: randomInt(MIN_WEIGHT, MAX_WEIGHT),
    });
  }

  let added = 0;
  let attempts = 0;
  while (added < extraEdges && attempts < extraEdges * 10) {
    attempts++;
    const a = ids[randomInt(0, ids.length - 1)];
    const b = ids[randomInt(0, ids.length - 1)];
    if (a === b) continue;
    const key = edgeKey(a, b);
    if (edgeSet.has(key)) continue;
    edgeSet.set(key, { source: a, target: b, weight: randomInt(MIN_WEIGHT, MAX_WEIGHT) });
    added++;
  }

  return {
    nodes: ids.map((id) => ({ id, label: id })), // labels get reassigned by generateGraph()
    edges: Array.from(edgeSet.values()),
  };
}

function buildAdjacencyIds(edges: SimpleEdge[]): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    if (!adj.has(e.target)) adj.set(e.target, []);
    adj.get(e.source)!.push(e.target);
    adj.get(e.target)!.push(e.source);
  }
  return adj;
}

function bfsDistance(start: string, adj: Map<string, string[]>): Map<string, number> {
  const dist = new Map<string, number>([[start, 0]]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const nb of adj.get(cur) ?? []) {
      if (!dist.has(nb)) {
        dist.set(nb, dist.get(cur)! + 1);
        queue.push(nb);
      }
    }
  }
  return dist;
}

/**
 * Full round-appropriate graph: structure + weights scale with
 * `round`, start/target are chosen randomly each time (at least 2
 * hops apart so it isn't trivial). Start/target are always labelled
 * "S" / "T" for UI clarity; every other node gets a letter.
 */
export function generateGraph(round: number): GeneratedGraph {
  const { nodeCount, extraEdges } = difficultyForRound(round);
  const { nodes, edges } = generateConnectedGraph(nodeCount, extraEdges);
  const adj = buildAdjacencyIds(edges);

  let start = nodes[0].id;
  let target = nodes[nodes.length - 1].id;
  let found = false;

  for (let attempt = 0; attempt < 20; attempt++) {
    const s = nodes[randomInt(0, nodes.length - 1)].id;
    const dist = bfsDistance(s, adj);
    const far = nodes.filter((n) => (dist.get(n.id) ?? 0) >= 2);
    if (far.length > 0) {
      start = s;
      target = far[randomInt(0, far.length - 1)].id;
      found = true;
      break;
    }
  }
  if (!found) {
    const dist = bfsDistance(nodes[0].id, adj);
    let best = nodes[0].id;
    let bestD = -1;
    for (const [id, d] of dist) if (d > bestD) { bestD = d; best = id; }
    start = nodes[0].id;
    target = best;
  }
    // Guarantee the start node has at least 2 outgoing edges where
  // possible, so the very first move is a real decision, not forced.
  const startDegree = (adj.get(start) ?? []).length;
  if (startDegree < 2 && nodes.length > 2) {
    const existing = new Set(adj.get(start) ?? []);
    const candidates = nodes
      .map((n) => n.id)
      .filter((id) => id !== start && id !== target && !existing.has(id));
    if (candidates.length > 0) {
      const extra = candidates[randomInt(0, candidates.length - 1)];
      edges.push({ source: start, target: extra, weight: randomInt(MIN_WEIGHT, MAX_WEIGHT) });
    }
  }

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  let letterIdx = 0;
  const labeled: SimpleNode[] = nodes.map((n) => {
    if (n.id === start) return { id: n.id, label: "S" };
    if (n.id === target) return { id: n.id, label: "T" };
    return { id: n.id, label: letters[letterIdx++] ?? n.id };
  });

  return { nodes: labeled, edges, start, target };
}
// ─── Floyd-Warshall round generation ──────────────────────────────
// Reuses generateConnectedGraph() above — no graph-generation logic
// duplicated. Produces the full sequence of (k, i, j) UPDATE steps
// only (cells where no improvement happens are skipped entirely, per
// the design plan — DP should only involve the player when a better
// path is actually found).

export interface FWStep {
  k: number;
  i: number;
  j: number;
  newValue: number;
}

export interface FWRound {
  labels: string[];
  initialMatrix: number[][]; // Infinity = no direct edge, 0 = diagonal
  steps: FWStep[];
}

export function fwDifficultyForRound(round: number) {
  const nodeCount = Math.min(4 + Math.floor(round / 2), 6);
  const extraEdges = Math.min(1 + Math.floor(round / 3), 3);
  return { nodeCount, extraEdges };
}

function computeFWSteps(matrix: number[][]): FWStep[] {
  const n = matrix.length;
  const working = matrix.map((row) => [...row]);
  const steps: FWStep[] = [];
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const through = working[i][k] + working[k][j];
        if (through < working[i][j]) {
          working[i][j] = through;
          steps.push({ k, i, j, newValue: through });
        }
      }
    }
  }
  return steps;
}

/**
 * Generates a round-appropriate graph as an adjacency matrix, plus the
 * ordered list of cells the Floyd-Warshall algorithm actually updates.
 * Retries with a fresh random graph if a tiny graph happens to need no
 * updates at all (rare, but possible with very few nodes).
 */
export function generateFloydWarshallRound(round: number): FWRound {
  const { nodeCount, extraEdges } = fwDifficultyForRound(round);
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  let best: { matrix: number[][]; steps: FWStep[] } | null = null;

  for (let attempt = 0; attempt < 8; attempt++) {
    const { nodes, edges } = generateConnectedGraph(nodeCount, extraEdges);
    const idx = new Map(nodes.map((n, i) => [n.id, i]));
    const n = nodes.length;
    const matrix: number[][] = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? 0 : Infinity))
    );
    for (const e of edges) {
      const a = idx.get(e.source)!;
      const b = idx.get(e.target)!;
      matrix[a][b] = Math.min(matrix[a][b], e.weight);
      matrix[b][a] = Math.min(matrix[b][a], e.weight);
    }
    const steps = computeFWSteps(matrix);
    if (!best || steps.length > best.steps.length) best = { matrix, steps };
    if (steps.length >= 3) break;
  }

  return {
    labels: letters.slice(0, nodeCount),
    initialMatrix: best!.matrix,
    steps: best!.steps,
  };
}