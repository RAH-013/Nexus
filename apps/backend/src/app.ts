import compression from "compression";
import express from "express";
import pinoHttp from "pino-http";
import swaggerUi from "swagger-ui-express";
import YAML from "yaml";
import fs from "node:fs";
import path from "node:path";

import { authRouter } from "./routes/auth";
import { actorCommentsRouter } from "./routes/actorComments";
import { cinemetaRouter } from "./routes/cinemeta";
import { commentsRouter } from "./routes/comments";
import { reactionsRouter } from "./routes/reactions";
import { recommendationsRouter } from "./routes/recommendations";
import { viewsRouter } from "./routes/views";
import { activityRouter } from "./routes/activity";
import { interactionsRouter } from "./routes/interactions";

import { healthRouter } from "./routes/health";
import { errorHandler } from "./middleware/error";
import { configureSecurity } from "./middleware/security";

export const app = express();

app.set("trust proxy", 1);

configureSecurity(app);

app.use(pinoHttp());

app.use("/api/auth", authRouter);
app.use("/api/cinemeta", cinemetaRouter);

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "50kb" }));

app.use(compression());

// Documentación
const openApiPath = path.resolve(process.cwd(), "src/docs/openapi.yaml");
const openApiDocument = YAML.parse(fs.readFileSync(openApiPath, "utf8"));

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

app.get("/api/openapi.yaml", (_req, res) => {
  res.type("text/yaml");
  res.sendFile(openApiPath);
});

// Después de express.json: el POST de comentarios necesita el cuerpo parseado.
app.use("/api/comments", commentsRouter);

// Comentarios de actores, igual que comentarios (cuerpo parseado).
app.use("/api/actors", actorCommentsRouter);

// Después de express.json (spec 003, D1), igual que comentarios.
app.use("/api/views", viewsRouter);

// Reacciones (favorito, me gusta, no me gusta), igual que vistos (spec 004).
app.use("/api/reactions", reactionsRouter);

// Interacciones avanzadas (calificaciones, descartes, impresiones, apertura de detalle).
app.use("/api/interactions", interactionsRouter);

// Recomendaciones «Para ti» (spec 004), igual que el resto de rutas privadas.
app.use("/api/recommendations", recommendationsRouter);

app.use("/health", healthRouter);

app.use("/api/activity", activityRouter);

app.use(errorHandler);
