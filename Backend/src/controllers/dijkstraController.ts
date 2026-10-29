import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { randomUUID } from "crypto";
import DijkstraMatch, { type IDijkstraMatch } from "../models/DijkstraMatch";
import GameSession from "../models/GameSession";
import {
  generateGraph,
  dijkstraShortestPath,
  isValidShortestPathStep,
} from "../utils/graphGenerator";
import {
  SOLO_SESSION_SECONDS,
  SOLO_GRACE_MS,
  SOLO_MAX_ROUNDS,
  SOLO_MIN_ROUND_MS,
} from "../config/sessionRules";

// Counts one finished round toward a solo session, with every rule the
// server enforces: once per graph, in order, inside the time window, and
// not faster than a human could play.
async function countSoloRound(match: IDijkstraMatch, userId: string): Promise<void> {
  if (!match.sessionId) return;

  const claimed = await DijkstraMatch.updateOne(
    { _id: match._id, completed: false },
    { $set: { completed: true } }
  );
  if (claimed.modifiedCount !== 1) return; // this graph was already counted

  const now = Date.now();
  if (now - match.createdAt.getTime() < SOLO_MIN_ROUND_MS) return;

  await GameSession.updateOne(
    {
      _id: match.sessionId,
      userId,
      status: "in_progress",
      roundsCompleted: match.round - 1,
      startedAt: { $gte: new Date(now - SOLO_SESSION_SECONDS * 1000 - SOLO_GRACE_MS) },
    },
    { $inc: { roundsCompleted: 1 } }
  );
}

export async function createDijkstraMatch(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId as string;
    const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : "";
    let round = Math.min(SOLO_MAX_ROUNDS, Math.max(1, Math.floor(Number(req.query.round)) || 1));

    let sessionObjectId: unknown;
    if (sessionId) {
      if (!mongoose.isValidObjectId(sessionId)) {
        res.status(400).json({ error: "Invalid sessionId" });
        return;
      }
      const session = await GameSession.findOne({
        _id: sessionId,
        userId,
        mode: "solo",
        gameType: "dijkstra",
        status: "in_progress",
      });
      if (!session) {
        res.status(404).json({ error: "Session not found or already finished." });
        return;
      }
      // Difficulty is decided by the server, never by the client.
      round = session.roundsCompleted + 1;
      if (round > SOLO_MAX_ROUNDS) {
        res.status(409).json({ error: "Round limit reached for this session." });
        return;
      }
      sessionObjectId = session._id;
    }

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
      userId,
            sessionId: sessionObjectId as mongoose.Types.ObjectId | undefined,
      round,
      currentNode: graph.start,
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

export async function validateDijkstraStep(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId as string;
    const { graphId, currentNode, chosenNode } = (req.body ?? {}) as {
      graphId?: unknown;
      currentNode?: unknown;
      chosenNode?: unknown;
    };

    if (
      typeof graphId !== "string" || !graphId ||
      typeof currentNode !== "string" || !currentNode ||
      typeof chosenNode !== "string" || !chosenNode
    ) {
      res.status(400).json({ error: "graphId, currentNode, and chosenNode are required" });
      return;
    }

    const match = await DijkstraMatch.findOne({ graphId });
    if (!match || String(match.userId) !== userId) {
      res.status(404).json({ error: "Match not found or expired" });
      return;
    }

    const validNodeIds = new Set(match.nodes.map((n) => n.id));
    if (!validNodeIds.has(currentNode) || !validNodeIds.has(chosenNode)) {
      res.status(400).json({ error: "currentNode or chosenNode is not valid for this graph" });
      return;
    }

    // The UI's Reset button sends currentNode = start: move the server's
    // copy of the player's position back to the start as well.
    if (currentNode === match.start && match.currentNode !== match.start) {
      await DijkstraMatch.updateOne({ _id: match._id }, { $set: { currentNode: match.start } });
      match.currentNode = match.start;
    }

    // The player must be where the server says they are, so rounds can't
    // be completed by jumping straight to the last step.
    let correct =
      currentNode === match.currentNode &&
      isValidShortestPathStep(
        match.nodes,
        match.edges,
        match.start,
        match.target,
        currentNode,
        chosenNode,
      );

    if (correct) {
      // Guarded write: a duplicate or parallel request can't move twice.
      const moved = await DijkstraMatch.updateOne(
        { _id: match._id, currentNode },
        { $set: { currentNode: chosenNode } }
      );
      correct = moved.modifiedCount === 1;
    }

    const isComplete = correct && chosenNode === match.target;

    if (match.sessionId) {
      await GameSession.updateOne(
        { _id: match.sessionId, userId, status: "in_progress" },
        { $inc: { attempts: 1, correctSteps: correct ? 1 : 0 } }
      );
      if (isComplete) await countSoloRound(match, userId);
    }

    res.json({ correct, isComplete });
  } catch (err) {
    next(err);
  }
}