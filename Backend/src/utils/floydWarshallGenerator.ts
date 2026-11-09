
import type {
  IFloydWarshallNode,
  IFloydWarshallEdge,
  IFloydWarshallStep,
} from "../models/FloydWarshallMatch";

const MIN_WEIGHT = 1;
const MAX_WEIGHT = 15;
const INF = Infinity;

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];

  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

export function difficultyForRound(round: number) {
  const nodeCount = Math.min(3 + Math.floor((round - 1) / 2), 6);

  const extraEdges = Math.min(
    1 + Math.floor(round / 2),
    4
  );

  return { nodeCount, extraEdges };
}

function edgeKey(a: string, b: string): string {
  return [a, b].sort().join("--");
}

export function generateConnectedGraph(
  nodeCount: number,
  extraEdges: number
): {
  nodes: IFloydWarshallNode[];
  edges: IFloydWarshallEdge[];
} {
  const ids = Array.from({ length: nodeCount }, (_, i) => `n${i}`);
  const order = shuffle(ids);

  const edgeSet = new Map<string, IFloydWarshallEdge>();

  // Generate a connected spanning tree.
  for (let i = 1; i < order.length; i++) {
    const child = order[i];
    const parent = order[randomInt(0, i - 1)];

    edgeSet.set(edgeKey(parent, child), {
      source: parent,
      target: child,
      weight: randomInt(MIN_WEIGHT, MAX_WEIGHT),
    });
  }

  // Add extra edges for alternate paths.
  let added = 0;
  let attempts = 0;

  while (added < extraEdges && attempts < extraEdges * 10) {
    attempts++;

    const a = ids[randomInt(0, ids.length - 1)];
    const b = ids[randomInt(0, ids.length - 1)];

    if (a === b) continue;

    const key = edgeKey(a, b);

    if (edgeSet.has(key)) continue;

    edgeSet.set(key, {
      source: a,
      target: b,
      weight: randomInt(MIN_WEIGHT, MAX_WEIGHT),
    });

    added++;
  }

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  return {
    nodes: ids.map((id, index) => ({
      id,
      label: letters[index],
    })),
    edges: Array.from(edgeSet.values()),
  };
}

export function createInitialMatrix(
  nodes: IFloydWarshallNode[],
  edges: IFloydWarshallEdge[]
): number[][] {
  const n = nodes.length;

  const matrix = Array.from(
    { length: n },
    (_, i) =>
      Array.from(
        { length: n },
        (_, j) => (i === j ? 0 : INF)
      )
  );

  const indexMap = new Map(
    nodes.map((node, index) => [node.id, index])
  );

  for (const edge of edges) {
    const u = indexMap.get(edge.source);
    const v = indexMap.get(edge.target);

    if (u === undefined || v === undefined) continue;

    matrix[u][v] = edge.weight;
    matrix[v][u] = edge.weight;
  }

  return matrix;
}

export function computeFloydWarshallSteps(
  initialMatrix: number[][]
): {
  steps: IFloydWarshallStep[];
  finalMatrix: number[][];
} {
  const dist = initialMatrix.map((row) => [...row]);
  const n = dist.length;

  const steps: IFloydWarshallStep[] = [];

  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;

        if (
          dist[i][k] === INF ||
          dist[k][j] === INF
        ) {
          continue;
        }

        const via = dist[i][k] + dist[k][j];

        if (via < dist[i][j]) {
          dist[i][j] = via;

          steps.push({
            k,
            i,
            j,
            newValue: via,
          });
        }
      }
    }
  }

  return {
    steps,
    finalMatrix: dist,
  };
}

export function generateFloydWarshallGraph(round: number) {
  const { nodeCount, extraEdges } = difficultyForRound(round);

  let nodes: IFloydWarshallNode[];
  let edges: IFloydWarshallEdge[];
  let initialMatrix: number[][];
  let steps: IFloydWarshallStep[];
  let finalMatrix: number[][];

  let attempts = 0;

  do {
    const graph = generateConnectedGraph(nodeCount, extraEdges);

    nodes = graph.nodes;
    edges = graph.edges;

    initialMatrix = createInitialMatrix(nodes, edges);

    const result = computeFloydWarshallSteps(initialMatrix);

    steps = result.steps;
    finalMatrix = result.finalMatrix;

    attempts++;
  } while (steps.length === 0 && attempts < 100);

  return {
    nodes,
    edges,
    start: nodes[0].id,
    target: nodes[nodes.length - 1].id,
    initialMatrix,
    steps,
    finalMatrix,
  };
}
