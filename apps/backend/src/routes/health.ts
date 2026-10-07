import { Router } from "express";
import { pingRedis } from "../lib/redis";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.status(200).json({
    status: "ok",
  });
});

healthRouter.get("/ready", async (_req, res) => {
  try {
    await pingRedis();
    return res.status(200).json({
      status: "ready",
      dependencies: {
        redis: "ok",
      },
    });
  } catch (error) {
    console.error("El backend no está listo:", error);

    return res.status(503).json({
      status: "not_ready",
      dependencies: {
        redis: "unavailable",
      },
    });
  }
});
