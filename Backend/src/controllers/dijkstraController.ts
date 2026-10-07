/**
 * dijkstraController.ts
 *
 * Two endpoints:
 *  - createDijkstraMatch: generates a round-appropriate graph, stores
 *    the shortest path server-side, returns everything EXCEPT the
 *    shortest path to the client.
 *  - validateDijkstraStep: checks whether the player's chosen next
 *    node is correct per the stored shortest path.
 */

import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import DijkstraMatch from "../models/DijkstraMatch";
import {
  generateGraph,
  dijkstraShortestPath,
  isValidNextStep,
} from "../utils/graphGenerator";

export async function createDijkstraMatch(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const round = Number(req.query.round) || 1;

    const graph = generateGraph(round);
    const { path: shortestPath } = dijkstraShortestPath(
      graph.nodes,
      graph.edges,
      graph.start,
      graph.target
    );

    const graphId = randomUUID();

    await DijkstraMatch.create({
      graphId,
      nodes: graph.nodes,
      edges: graph.edges,
      start: graph.start,
      target: graph.target,
      shortestPath,
    });

    // IMPORTANT: shortestPath is never sent to the client.
    res.json({
      graphId,
      nodes: graph.nodes,
      edges: graph.edges,
      start: graph.start,
      target: graph.target,
    });
  } catch (err) {
    next(err);
  }
}

export async function validateDijkstraStep(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { graphId, currentNode, chosenNode } = req.body as {
      graphId?: string;
      currentNode?: string;
      chosenNode?: string;
    };

    if (!graphId || !currentNode || !chosenNode) {
      res.status(400).json({ error: "graphId, currentNode, and chosenNode are required" });
      return;
    }

    const match = await DijkstraMatch.findOne({ graphId });
    if (!match) {
      res.status(404).json({ error: "Match not found or expired" });
      return;
    }

    const validNodeIds = new Set(match.nodes.map((n) => n.id));
    if (!validNodeIds.has(currentNode) || !validNodeIds.has(chosenNode)) {
      res.status(400).json({ error: "currentNode or chosenNode is not valid for this graph" });
      return;
    }

    const correct = isValidNextStep(match.shortestPath, currentNode, chosenNode);
    const isComplete = correct && chosenNode === match.target;

    res.json({ correct, isComplete });
  } catch (err) {
    next(err);
  }
}