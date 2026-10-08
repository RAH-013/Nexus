import type { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

export function configureSecurity(app: Express) {
  app.disable("x-powered-by");

  app.use(helmet());

  app.use(
    cors({
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
      // Las sondas de salud de Docker (cada 5 s) son tráfico de
      // infraestructura: no consumen el límite de las peticiones
      // de usuario (con ellas solas ya serían ~180 de 300).
      skip: (request) =>
        request.path === "/health" || request.path === "/health/ready",
    }),
  );
}
