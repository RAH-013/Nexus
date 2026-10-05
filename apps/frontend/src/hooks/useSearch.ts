import { useEffect, useState } from "react";
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
}

function idleState(query: string): SearchState {
  return { status: "idle", items: [], hasMore: false, query };
}

/**
 * Máquina de estados de la búsqueda (plan §4.5): una petición por cambio de
 * texto que alcance el umbral, cancelando la anterior; lo que llegue tarde se
 * descarta y nunca se pinta una lista que no corresponda al texto actual.
 */
export function useSearch(rawQuery: string): SearchState {
  const query = rawQuery.trim().slice(0, MAX_QUERY_LENGTH);
  const [state, setState] = useState<SearchState>(() => idleState(""));

  useEffect(() => {
    if (query.length < MIN_QUERY_LENGTH) {
      return;
    }

    const controller = new AbortController();
    let active = true;

    void apiSearch(query, "all", controller.signal).then((result) => {
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
        });

        return;
      }

      setState({
        status: result.data.results.length > 0 ? "results" : "empty",
        items: result.data.results,
        hasMore: result.data.hasMore,
        query,
      });
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [query]);

  // Los datos guardados son de otro texto: se muestra como si cargara (o en
  // reposo, si no se ha llegado al umbral de 3 caracteres).
  if (state.query !== query) {
    return query.length < MIN_QUERY_LENGTH
      ? idleState(query)
      : { status: "loading", items: [], hasMore: false, query };
  }

  return state;
}
