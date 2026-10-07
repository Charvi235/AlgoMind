import type { SimpleEdge, SimpleNode } from "./graphGenerator";

export function createDistanceMatrix(
  nodes: SimpleNode[],
  edges: SimpleEdge[]
) {
  const n = nodes.length;

  const dist: number[][] = Array.from(
    { length: n },
    () => Array(n).fill(Infinity)
  );

  // Distance from a node to itself
  for (let i = 0; i < n; i++) {
    dist[i][i] = 0;
  }

  // Add graph edges
  for (const edge of edges) {
    const u = nodes.findIndex((node) => node.id === edge.source);
    const v = nodes.findIndex((node) => node.id === edge.target);

    dist[u][v] = edge.weight;
    dist[v][u] = edge.weight;
  }

  // Floyd-Warshall
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        dist[i][j] = Math.min(
          dist[i][j],
          dist[i][k] + dist[k][j]
        );
      }
    }
  }

  return dist;
}