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

// TEMPORAL: integración con el simulador externo para las pruebas 21–25.
// Elimina este bloque cuando termines las pruebas.
//
// Comprueba que EXTERNO_URL esté configurada y que el simulador responda:
// - 5xx (o caída): reintenta una sola vez, para que «falla_una» termine en 2xx.
// - Más de 7 s de espera: 502, para que «lento» (20 s) responda antes de 10 s.
// - 2xx que no es JSON («basura»): 502, porque no se puede leer la respuesta.
const EXTERNO_TIMEOUT_MS = 7000;
const EXTERNO_REINTENTO_MS = 250;

async function llamarExterno(
  externoUrl: string,
): Promise<{ status: number; body: string }> {
  const response = await fetch(externoUrl, {
    method: "GET",
    signal: AbortSignal.timeout(EXTERNO_TIMEOUT_MS),
  });

  return { status: response.status, body: await response.text() };
}

app.get("/api/test-externo", async (_req, res) => {
  const externoUrl = process.env.EXTERNO_URL;

  if (!externoUrl) {
    return res.status(500).json({
      error: "EXTERNO_URL no está configurada",
    });
  }

  let respuesta: { status: number; body: string };

  try {
    respuesta = await llamarExterno(externoUrl);

    if (respuesta.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, EXTERNO_REINTENTO_MS));
      respuesta = await llamarExterno(externoUrl);
    }
  } catch (error) {
    return res.status(502).json({
      error: "No se pudo conectar con el servicio externo",
      detalles: error instanceof Error ? error.message : String(error),
    });
  }

  if (respuesta.status >= 400) {
    return res.status(respuesta.status).json({
      message: "Respuesta del servicio externo",
      status: respuesta.status,
      body: respuesta.body,
    });
  }

  try {
    JSON.parse(respuesta.body);
  } catch {
    return res.status(502).json({
      error: "El servicio externo respondió algo que no es JSON",
      body: respuesta.body.slice(0, 200),
    });
  }

  return res.status(200).json({
    message: "Respuesta del servicio externo",
    status: respuesta.status,
    body: respuesta.body,
  });
});

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
