/**
 * graphGenerator.ts (Backend)
 *
 * Server-authoritative graph generation — mirrors the frontend's
 * logic exactly, but this is now the ONLY place a Dijkstra graph is
 * actually generated or validated. The frontend will request a graph
 * from the API and never computes one itself.
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

export function difficultyForRound(round: number) {
  const nodeCount = Math.min(4 + round, 10);
  const extraEdges = Math.min(1 + Math.floor(round / 2), 4);
  return { nodeCount, extraEdges };
}

const edgeKey = (a: string, b: string) => [a, b].sort().join("--");

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
    nodes: ids.map((id) => ({ id, label: id })),
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

// ─── Dijkstra shortest path (for server-side validation) ──────────
export function dijkstraShortestPath(
  nodes: SimpleNode[],
  edges: SimpleEdge[],
  start: string,
  target: string
): { path: string[]; prev: Map<string, string | null> } {
  const adj = new Map<string, { id: string; weight: number }[]>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    if (!adj.has(e.target)) adj.set(e.target, []);
    adj.get(e.source)!.push({ id: e.target, weight: e.weight });
    adj.get(e.target)!.push({ id: e.source, weight: e.weight });
  }

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

  const path: string[] = [];
  let cur: string | null = target;
  while (cur) { path.unshift(cur); cur = prev.get(cur) ?? null; }

  return { path, prev };
}

/**
 * Returns true when moving from currentNode to chosenNode is a valid step
 * on SOME shortest path from start to target.
 *
 * The check uses the "on-shortest-path" condition:
 *   dS[currentNode] + weight(currentNode, chosenNode) + dT[chosenNode] === dS[target]
 *
 * where dS = shortest distances from start and dT = shortest distances from
 * target (both computed via Dijkstra). This accepts every optimal move, not
 * just the single path that was stored at round creation time.
 */
export function isValidShortestPathStep(
  nodes: SimpleNode[],
  edges: SimpleEdge[],
  start: string,
  target: string,
  currentNode: string,
  chosenNode: string
): boolean {
  // Build weighted adjacency (undirected).
  const adj = new Map<string, { id: string; weight: number }[]>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    if (!adj.has(e.target)) adj.set(e.target, []);
    adj.get(e.source)!.push({ id: e.target, weight: e.weight });
    adj.get(e.target)!.push({ id: e.source, weight: e.weight });
  }

  // Verify the edge currentNode→chosenNode actually exists and get its weight.
  const edge = adj.get(currentNode)?.find((nb) => nb.id === chosenNode);
  if (!edge) return false;

  // Dijkstra from a single source, returns Map<nodeId, distance>.
  function shortestDist(src: string): Map<string, number> {
    const dist = new Map<string, number>();
    for (const n of nodes) dist.set(n.id, Infinity);
    dist.set(src, 0);
    const remaining = new Set(nodes.map((n) => n.id));
    while (remaining.size) {
      // Pick unvisited node with smallest tentative distance.
      let u = "";
      let minD = Infinity;
      for (const id of remaining) {
        const d = dist.get(id)!;
        if (d < minD) { minD = d; u = id; }
      }
      if (!u || minD === Infinity) break;
      remaining.delete(u);
      for (const { id: v, weight } of adj.get(u) ?? []) {
        if (!remaining.has(v)) continue;
        const alt = dist.get(u)! + weight;
        if (alt < dist.get(v)!) dist.set(v, alt);
      }
    }
    return dist;
  }

  const dS = shortestDist(start);
  const dT = shortestDist(target);

  const totalShortest = dS.get(target);
  if (totalShortest === undefined || totalShortest === Infinity) return false;

  const dSCurrent = dS.get(currentNode) ?? Infinity;
  const dTChosen  = dT.get(chosenNode)  ?? Infinity;

  return dSCurrent + edge.weight + dTChosen === totalShortest;
}