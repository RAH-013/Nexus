import compression from "compression";
import express from "express";
import pinoHttp from "pino-http";

import { authRouter } from "./routes/auth";
import { cinemetaRouter } from "./routes/cinemeta";
import { commentsRouter } from "./routes/comments";

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

app.use("/health", healthRouter);

app.use(errorHandler);
