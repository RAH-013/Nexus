import { useCallback, useEffect, useState } from "react";
import { apiSearch, type MediaItem } from "../api/cinemeta";

const MIN_QUERY_LENGTH = 3;
const MAX_QUERY_LENGTH = 80;

export type SearchStatus =
  | "idle"
  | "loading"
  | "results"
  | "empty"
  | "error"
  | "rate-limit";

interface SearchState {
  status: SearchStatus;
  items: MediaItem[];
  hasMore: boolean;
  /** Texto recortado al que corresponden los datos guardados. */
  query: string;
  /** Intento que produjo los datos guardados (el reintento los invalida). */
  attempt: number;
}

type SearchReturn = SearchState & {
  /** Repite la petición del texto actual (vista de resultados, RF-7 enmienda). */
  retry: () => void;
};

function idleState(query: string, attempt: number): SearchState {
  return { status: "idle", items: [], hasMore: false, query, attempt };
}

/**
 * Máquina de estados de la búsqueda (plan §4.5): una petición por cambio de
 * texto que alcance el umbral, cancelando la anterior; lo que llegue tarde se
 * descarta y nunca se pinta una lista que no corresponda al texto actual.
 * `limit` opcional: el panel no lo pasa (10 por defecto) y la vista de
 * resultados pide más coincidencias.
 */
export function useSearch(rawQuery: string, limit?: number): SearchReturn {
  const query = rawQuery.trim().slice(0, MAX_QUERY_LENGTH);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<SearchState>(() => idleState("", 0));

  useEffect(() => {
    if (query.length < MIN_QUERY_LENGTH) {
      return;
    }

    const controller = new AbortController();
    let active = true;

    void apiSearch(query, "all", controller.signal, limit).then((result) => {
      if (!active) {
        return;
      }

      if (!result.success) {
        if (result.error === "aborted") {
          return;
        }

        setState({
          status: result.error === "rate-limit" ? "rate-limit" : "error",
          items: [],
          hasMore: false,
          query,
          attempt,
        });

        return;
      }

      setState({
        status: result.data.results.length > 0 ? "results" : "empty",
        items: result.data.results,
        hasMore: result.data.hasMore,
        query,
        attempt,
      });
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [query, limit, attempt]);

  const retry = useCallback(() => {
    setAttempt((current) => current + 1);
  }, []);

  // Los datos guardados son de otro texto (o de un intento anterior): se muestra
  // como si cargara (o en reposo, si no se ha llegado al umbral de 3 caracteres).
  if (state.query !== query || state.attempt !== attempt) {
    return query.length < MIN_QUERY_LENGTH
      ? { ...idleState(query, attempt), retry }
      : { status: "loading", items: [], hasMore: false, query, attempt, retry };
  }

  return { ...state, retry };
}
