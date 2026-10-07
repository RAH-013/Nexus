import compression from "compression";
import express from "express";
import pinoHttp from "pino-http";

import { authRouter } from "./routes/auth";
import { actorCommentsRouter } from "./routes/actorComments";
import { cinemetaRouter } from "./routes/cinemeta";
import { commentsRouter } from "./routes/comments";
import { viewsRouter } from "./routes/views";
import { activityRouter } from "./routes/activity";

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

// Después de express.json: el POST de comentarios necesita el cuerpo parseado.
app.use("/api/comments", commentsRouter);

// Comentarios de actores, igual que comentarios (cuerpo parseado).
app.use("/api/actors", actorCommentsRouter);

// Después de express.json (spec 003, D1), igual que comentarios.
app.use("/api/views", viewsRouter);

app.use("/health", healthRouter);

app.use("/api/activity", activityRouter);

app.use(errorHandler);
