import { useCallback, useEffect, useState } from "react";
import {
  apiGetActor,
  type ApiError,
  type ActorDetail,
} from "../api/cinemeta";

export type ActorStatus =
  | "loading"
  | "ready"
  | "not-found"
  | "error"
  | "rate-limit";

interface ActorState {
  actor: ActorDetail | null;
  status: ActorStatus;
  /** Vuelve a pedir solo este perfil. */
  retry: () => void;
}

type CachedResult =
  | { success: true; data: ActorDetail }
  | { success: false; error: ApiError };

interface CacheEntry {
  promise: Promise<CachedResult>;
}

/** Lo guardado pertenece a otra carga (`actor#intento`). */
interface LoadedActor {
  key: string;
  actor: ActorDetail | null;
  status: ActorStatus;
}

/**
 * Perfiles cacheados por módulo: se pide una sola vez por actor
 * mientras viva la pestaña y se reutiliza al volver atrás.
 */
const actorCache = new Map<string, CacheEntry>();

function load(name: string): Promise<CachedResult> {
  const cached = actorCache.get(name);

  if (cached) {
    return cached.promise;
  }

  const promise: Promise<CachedResult> = apiGetActor(name).then(
    (result): CachedResult => {
      if (result.success) {
        return { success: true, data: result.data };
      }

      // Solo se cachea el acierto: «Reintentar» y el 404 vuelven a pedir.
      if (actorCache.get(name)?.promise === promise) {
        actorCache.delete(name);
      }

      return { success: false, error: result.error };
    },
  );

  actorCache.set(name, { promise });

  return promise;
}

export function useActorData(name: string): ActorState {
  const [attempt, setAttempt] = useState(0);
  const key = `actor:${name}#${attempt}`;
  const [loaded, setLoaded] = useState<LoadedActor>({
    key,
    actor: null,
    status: "loading",
  });

  useEffect(() => {
    const requestKey = `actor:${name}#${attempt}`;
    let active = true;

    void load(name).then((result) => {
      if (!active) {
        return;
      }

      if (!result.success) {
        if (result.error === "aborted") {
          return;
        }

        setLoaded({
          key: requestKey,
          actor: null,
          status:
            result.error === "not-found"
              ? "not-found"
              : result.error === "rate-limit"
                ? "rate-limit"
                : "error",
        });

        return;
      }

      setLoaded({ key: requestKey, actor: result.data, status: "ready" });
    });

    return () => {
      active = false;
    };
  }, [name, attempt]);

  const retry = useCallback(() => {
    actorCache.delete(name);
    setAttempt((current) => current + 1);
  }, [name]);

  // Otra clave (primer montaje, otro actor o reintento): se muestra
  // como carga mientras llega la respuesta.
  const stale = loaded.key !== key;

  return {
    actor: stale ? null : loaded.actor,
    status: stale ? "loading" : loaded.status,
    retry,
  };
}
