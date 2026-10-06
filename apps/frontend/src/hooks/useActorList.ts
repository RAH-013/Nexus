import { useCallback, useEffect, useState } from "react";
import { apiGetActors, type ActorEntry, type ApiError } from "../api/cinemeta";

export type ActorListStatus =
  | "loading"
  | "ready"
  | "empty"
  | "error"
  | "rate-limit";

interface ActorListState {
  actors: ActorEntry[];
  status: ActorListStatus;
  /** Refetch de la agregación de actores. */
  retry: () => void;
}

type CachedResult =
  | { success: true; data: ActorEntry[] }
  | { success: false; error: ApiError };

/** Lo guardado pertenece a otra carga (`#intento`). */
interface LoadedActors {
  key: string;
  actors: ActorEntry[];
  status: ActorListStatus;
}

/**
 * La agregación se pide como máximo una vez por pestaña del navegador:
 * único resultado en memoria que guarda solo aciertos.
 */
let actorsPromise: Promise<CachedResult> | null = null;

function load(): Promise<CachedResult> {
  if (!actorsPromise) {
    const promise: Promise<CachedResult> = apiGetActors().then(
      (result): CachedResult => {
        if (result.success) {
          return { success: true, data: result.data };
        }

        // Los fallos no se guardan: «Reintentar» debe volver a pedir.
        if (actorsPromise === promise) {
          actorsPromise = null;
        }

        return { success: false, error: result.error };
      },
    );

    actorsPromise = promise;
  }

  return actorsPromise;
}

export function useActorList(): ActorListState {
  const [attempt, setAttempt] = useState(0);
  const key = `#${attempt}`;
  const [loaded, setLoaded] = useState<LoadedActors>({
    key,
    actors: [],
    status: "loading",
  });

  useEffect(() => {
    const requestKey = `#${attempt}`;
    let active = true;

    void load().then((result) => {
      if (!active) {
        return;
      }

      if (!result.success) {
        if (result.error === "aborted") {
          return;
        }

        setLoaded({
          key: requestKey,
          actors: [],
          status: result.error === "rate-limit" ? "rate-limit" : "error",
        });

        return;
      }

      setLoaded({
        key: requestKey,
        actors: result.data,
        status: result.data.length > 0 ? "ready" : "empty",
      });
    });

    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    actorsPromise = null;
    setAttempt((current) => current + 1);
  }, []);

  // Reintento en curso: se muestra el estado loading
  const stale = loaded.key !== key;

  return {
    actors: stale ? [] : loaded.actors,
    status: stale ? "loading" : loaded.status,
    retry,
  };
}
