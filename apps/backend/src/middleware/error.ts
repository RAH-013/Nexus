import type { ErrorRequestHandler } from "express";
import { env } from "../config/env";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const status = typeof error?.status === "number" ? error.status : 500;

  const message =
    env.NODE_ENV === "production"
      ? "Internal server error"
      : error instanceof Error
        ? error.message
        : "Unknown error";

  res.status(status).json({
    error: message,
  });
};
