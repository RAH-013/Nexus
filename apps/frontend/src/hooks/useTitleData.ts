import { useCallback, useEffect, useState } from "react";
import {
  apiGetTitle,
  type ApiError,
  type MediaType,
  type TitleDetail,
} from "../api/cinemeta";

export type TitleStatus =
  | "loading"
  | "ready"
  | "not-found"
  | "error"
  | "rate-limit";

interface TitleState {
  title: TitleDetail | null;
  status: TitleStatus;
  /** Vuelve a pedir solo esta ficha (RF-7). */
  retry: () => void;
}

type CachedResult =
  | { success: true; data: TitleDetail }
  | { success: false; error: ApiError };

interface CacheEntry {
  promise: Promise<CachedResult>;
}

/** Lo guardado pertenece a otra carga (`type:id#intento`). */
interface LoadedTitle {
  key: string;
  title: TitleDetail | null;
  status: TitleStatus;
}

/**
 * Fichas cacheadas por módulo: se pide una sola vez por título mientras viva
 * la pestaña y se reutiliza al volver atrás (RNF-1, D8).
 */
const titleCache = new Map<string, CacheEntry>();

function load(type: MediaType, id: string): Promise<CachedResult> {
  const key = `${type}:${id}`;
  const cached = titleCache.get(key);

  if (cached) {
    return cached.promise;
  }

  const promise: Promise<CachedResult> = apiGetTitle(type, id).then(
    (result): CachedResult => {
      if (result.success) {
        return { success: true, data: result.data };
      }

      // Solo se cachea el acierto: «Reintentar» y el 404 vuelven a pedir (RF-7).
      if (titleCache.get(key)?.promise === promise) {
        titleCache.delete(key);
      }

      return { success: false, error: result.error };
    },
  );

  titleCache.set(key, { promise });

  return promise;
}

export function useTitleData(type: MediaType, id: string): TitleState {
  const [attempt, setAttempt] = useState(0);
  const key = `${type}:${id}#${attempt}`;
  const [loaded, setLoaded] = useState<LoadedTitle>({
    key,
    title: null,
    status: "loading",
  });

  useEffect(() => {
    const requestKey = `${type}:${id}#${attempt}`;
    let active = true;

    void load(type, id).then((result) => {
      if (!active) {
        return;
      }

      if (!result.success) {
        if (result.error === "aborted") {
          return;
        }

        setLoaded({
          key: requestKey,
          title: null,
          status:
            result.error === "not-found"
              ? "not-found"
              : result.error === "rate-limit"
                ? "rate-limit"
                : "error",
        });

        return;
      }

      setLoaded({ key: requestKey, title: result.data, status: "ready" });
    });

    return () => {
      active = false;
    };
  }, [type, id, attempt]);

  const retry = useCallback(() => {
    titleCache.delete(`${type}:${id}`);
    setAttempt((current) => current + 1);
  }, [type, id]);

  // Otra clave (primer montaje, otro título o reintento): se muestra como
  // carga mientras llega la respuesta.
  const stale = loaded.key !== key;

  return {
    title: stale ? null : loaded.title,
    status: stale ? "loading" : loaded.status,
    retry,
  };
}
