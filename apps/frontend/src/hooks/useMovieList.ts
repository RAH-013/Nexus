import { useCallback, useEffect, useState } from "react";
import {
  apiGetMovieList,
  type ApiError,
  type MediaItem,
  type MovieList,
} from "../api/cinemeta";

export type MovieListStatus =
  | "loading"
  | "ready"
  | "empty"
  | "error"
  | "rate-limit";

interface MovieListState {
  items: MediaItem[];
  status: MovieListStatus;
  /** Refetch solo de esta lista (RF-4). */
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
  status: MovieListStatus;
}

/**
 * Cada lista se pide como máximo una vez por pestaña mientras viva la
 * pestaña del navegador (RNF-1): Map de módulo sin TTL y solo aciertos.
 */
const listCache = new Map<MovieList, CacheEntry>();

function load(list: MovieList): Promise<CachedResult> {
  const cached = listCache.get(list);

  if (cached) {
    return cached.promise;
  }

  const promise: Promise<CachedResult> = apiGetMovieList(list).then(
    (result): CachedResult => {
      if (result.success) {
        return { success: true, data: result.data };
      }

      // Los fallos no se guardan: «Reintentar» debe volver a pedir (RF-4).
      if (listCache.get(list)?.promise === promise) {
        listCache.delete(list);
      }

      return { success: false, error: result.error };
    },
  );

  listCache.set(list, { promise });

  return promise;
}

export function useMovieList(list: MovieList): MovieListState {
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

  // Otra lista (cambio de pestaña o reintento): se pinta como si cargara.
  const stale = loaded.key !== key;

  return {
    items: stale ? [] : loaded.items,
    status: stale ? "loading" : loaded.status,
    retry,
  };
}