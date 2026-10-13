import { createClient } from "redis";
import { env } from "../config/env";

const redis = createClient({
  url: env.REDIS_URL,
  // Reintentos acotados (en redis v5 la estrategia va dentro de `socket`):
  // si Redis no aparece, `connect()` falla rápido y la caché degrada (la
  // siguiente operación vuelve a probar la conexión).
  socket: {
    reconnectStrategy: (retries) =>
      retries >= 3
        ? new Error("Redis no disponible")
        : Math.min(retries * 100, 500),
  },
});
// redis v5: connect() resuelve con el cliente, no con void.
let connection: Promise<unknown> | undefined;

redis.on("error", (error) => {
  console.error("Error de conexión con Redis:", error);
});

/** Asegura la conexión lazy compartida; si falla, el próximo intento reintenta. */
async function ensureConnection(): Promise<void> {
  if (!redis.isOpen) {
    try {
      connection ??= redis.connect();
      await connection;
    } catch (error) {
      // Sin esta limpieza la promesa rechazada quedaría clavada para siempre
      // y ni el healthcheck ni la caché podrían recuperarse.
      connection = undefined;
      throw error;
    }
  }
}

export async function pingRedis(): Promise<void> {
  await ensureConnection();

  await redis.ping();
}

/**
 * JSON de una clave de caché. Redis caído o clave ausente → `null`: el
 * consumidor decide (volver a calcular). Los errores de conexión ya los
 * registra el manejador `redis.on("error")`.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    await ensureConnection();
    const raw = await redis.get(key);

    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Guarda JSON con TTL en segundos. Redis caído → se ignora (solo caché). */
export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  try {
    await ensureConnection();
    await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch {
    // La caché es prescindible: la respuesta ya se calculó.
  }
}

/** Borra una clave de caché (refresh manual). Redis caído → se ignora. */
export async function cacheDel(key: string): Promise<void> {
  try {
    await ensureConnection();
    await redis.del(key);
  } catch {
    // Ver nota en `cacheSet`.
  }
}
