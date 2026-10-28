import type { Request, Response, NextFunction } from "express";

export interface AppError extends Error {
  statusCode?: number;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;

  // Always log the real message and stack so nothing is silently swallowed.
  console.error(`[Error] ${statusCode} - ${err.message}\n${err.stack ?? ""}`);

  // In production, redact server-error details from the response so internal
  // implementation details are never leaked to clients.
  const isServerError = statusCode >= 500;
  const message =
    isServerError && process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message || "Internal server error";

  res.status(statusCode).json({ error: message });
}