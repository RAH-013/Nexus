import { createClient } from "redis";
import { env } from "../config/env";

const redis = createClient({ url: env.REDIS_URL });
let connection: Promise<void> | undefined;

redis.on("error", (error) => {
  console.error("Error de conexión con Redis:", error);
});

export async function pingRedis(): Promise<void> {
  if (!redis.isOpen) {
    connection ??= redis.connect();
    await connection;
  }

  await redis.ping();
}
