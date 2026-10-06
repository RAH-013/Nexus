import { useCallback, useEffect, useState } from "react";
import {
  apiGetSeriesList,
  type ApiError,
  type MediaItem,
  type SeriesList,
} from "../api/cinemeta";

export type SeriesListStatus =
  | "loading"
  | "ready"
  | "empty"
  | "error"
  | "rate-limit";

interface SeriesListState {
  items: MediaItem[];
  status: SeriesListStatus;
  /** Refetch solo de esta lista. */
  retry: () => void;
}

type CachedResult =
  | { success: true; data: MediaItem[] }
  | { success: false; error: ApiError };

interface CacheEntry {
  promise: Promise<CachedResult>;
}

/** Lo guardado pertenece a otra carga (`lista#intento`). */
interface LoadedList {
  key: string;
  items: MediaItem[];
  status: SeriesListStatus;
}

/**
 * Cada lista de series se pide como máximo una vez por pestaña mientras viva
 * la pestaña del navegador: Map de módulo sin TTL que guarda solo aciertos.
 */
const listCache = new Map<SeriesList, CacheEntry>();

function load(list: SeriesList): Promise<CachedResult> {
  const cached = listCache.get(list);

  if (cached) {
    return cached.promise;
  }

  const promise: Promise<CachedResult> = apiGetSeriesList(list).then(
    (result): CachedResult => {
      if (result.success) {
        return { success: true, data: result.data };
      }

      // Los fallos no se guardan: «Reintentar» debe volver a pedir.
      if (listCache.get(list)?.promise === promise) {
        listCache.delete(list);
      }

      return { success: false, error: result.error };
    },
  );

  listCache.set(list, { promise });

  return promise;
}

export function useSeriesList(list: SeriesList): SeriesListState {
  const [attempt, setAttempt] = useState(0);
  const key = `${list}#${attempt}`;
  const [loaded, setLoaded] = useState<LoadedList>({
    key,
    items: [],
    status: "loading",
  });

  useEffect(() => {
    const requestKey = `${list}#${attempt}`;
    let active = true;

    void load(list).then((result) => {
      if (!active) {
        return;
      }

      if (!result.success) {
        if (result.error === "aborted") {
          return;
        }

        setLoaded({
          key: requestKey,
          items: [],
          status: result.error === "rate-limit" ? "rate-limit" : "error",
        });

        return;
      }

      setLoaded({
        key: requestKey,
        items: result.data,
        status: result.data.length > 0 ? "ready" : "empty",
      });
    });

    return () => {
      active = false;
    };
  }, [list, attempt]);

  const retry = useCallback(() => {
    listCache.delete(list);
    setAttempt((current) => current + 1);
  }, [list]);

  // Otra lista (cambio de pestaña o reintento): se muestra el estado loading
  const stale = loaded.key !== key;

  return {
    items: stale ? [] : loaded.items,
    status: stale ? "loading" : loaded.status,
    retry,
  };
}