import { useCallback, useEffect, useState } from "react";
import {
  apiGetCollection,
  type ApiError,
  type Collection,
  type MediaItem,
} from "../api/cinemeta";

/** Cada sección se pide una vez por carga de página (plan D8, RNF-6). */
const CACHE_TTL_MS = 5 * 60_000;

export type SectionStatus = "loading" | "ready" | "empty" | "error" | "rate-limit";

interface SectionState {
  items: MediaItem[];
  status: SectionStatus;
  /** Refetch solo de esta colección (RF-13). */
  retry: () => void;
}

type CachedResult =
  | { success: true; data: MediaItem[] }
  | { success: false; error: ApiError };

interface CacheEntry {
  promise: Promise<CachedResult>;
  expires: number;
}

/** Lo guardado pertenece a otra carga (`colección#intento`). */
interface LoadedSection {
  key: string;
  items: MediaItem[];
  status: SectionStatus;
}

const collectionCache = new Map<string, CacheEntry>();

function load(collection: Collection): Promise<CachedResult> {
  const cached = collectionCache.get(collection);

  if (cached && cached.expires > Date.now()) {
    return cached.promise;
  }

  const promise: Promise<CachedResult> = apiGetCollection(collection).then(
    (result): CachedResult => {
      if (result.success) {
        return { success: true, data: result.data };
      }

      // Los fallos no se guardan: «Reintentar» debe volver a pedir (RF-13).
      if (collectionCache.get(collection)?.promise === promise) {
        collectionCache.delete(collection);
      }

      return { success: false, error: result.error };
    },
  );

  collectionCache.set(collection, {
    promise,
    expires: Date.now() + CACHE_TTL_MS,
  });

  return promise;
}

export function useSectionData(collection: Collection): SectionState {
  const [attempt, setAttempt] = useState(0);
  const key = `${collection}#${attempt}`;
  const [loaded, setLoaded] = useState<LoadedSection>({
    key,
    items: [],
    status: "loading",
  });

  useEffect(() => {
    const requestKey = `${collection}#${attempt}`;
    let active = true;

    void load(collection).then((result) => {
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
  }, [collection, attempt]);

  const retry = useCallback(() => {
    collectionCache.delete(collection);
    setAttempt((current) => current + 1);
  }, [collection]);

  // Carga distinta a la guardada (primer montaje, otra colección o un
  // reintento): se pinta como si cargara mientras llega la respuesta.
  const stale = loaded.key !== key;

  return {
    items: stale ? [] : loaded.items,
    status: stale ? "loading" : loaded.status,
    retry,
  };
}
