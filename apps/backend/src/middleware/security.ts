import type { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { env } from "../config/env";

const allowedOrigins = new Set(env.CORS_ORIGINS);

export function configureSecurity(app: Express) {
  app.disable("x-powered-by");

  app.use(helmet());

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) {
          return callback(null, true);
        }

        return callback(null, allowedOrigins.has(origin));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      skip: (request) =>
        request.path === "/health" || request.path === "/health/ready",
    }),
  );
}
