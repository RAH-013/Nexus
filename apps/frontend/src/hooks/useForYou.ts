import { useCallback, useEffect, useState } from "react";
import {
  apiGetForYou,
  type ForYouData,
} from "../api/recommendations";
import { useUser } from "./useUser";

/**
 * Estados de la vista «Para ti» (RF-13): `rate-limit` separa el 429 del
 * error genérico (mismo criterio que `useInfiniteActivity`) y `unauthorized`
 * marca la pérdida de sesión. `empty` es la lista sin actividad (RF-13).
 */
export type ForYouStatus =
  | "loading"
  | "ready"
  | "empty"
  | "error"
  | "rate-limit"
  | "unauthorized";

export interface UseForYouResult {
  status: ForYouStatus;
  /** Lista actual; `null` mientras carga o si hubo error. */
  data: ForYouData | null;
  /** Reintenta la petición normal (estado de error). */
  retry: () => void;
  /** Pide `?refresh=1` y vuelve al skeleton (RF-14). */
  refresh: () => void;
}

/**
 * Carga `GET /api/recommendations/for-you` una vez por visita (la caché de
 * servidor hace el resto). `refresh` fuerza el recálculo. Sin sesión no se
 * peticiona: la ruta privada redirige, pero el hook se mantiene honesto.
 */
export function useForYou(): UseForYouResult {
  const { user, loading, refreshUser } = useUser();
  const userId = user?.id ?? null;

  const [state, setState] = useState<{
    status: ForYouStatus;
    data: ForYouData | null;
  }>({ status: "loading", data: null });

  // Cada `load` incrementa el intento y arrastra la bandera de refresco.
  const [attempt, setAttempt] = useState({ n: 0, refresh: false });

  const load = useCallback(
    (refresh: boolean): void => {
      if (!userId) {
        return;
      }

      setState({ status: "loading", data: null });
      setAttempt((previous) => ({ n: previous.n + 1, refresh }));
    },
    [userId],
  );

  const retry = useCallback(() => load(false), [load]);
  const refresh = useCallback(() => load(true), [load]);

  useEffect(() => {
    if (loading || !userId) {
      return;
    }

    const controller = new AbortController();
    let active = true;

    void apiGetForYou(attempt.refresh, controller.signal).then((result) => {
      if (!active) {
        return;
      }

      if (result.success) {
        setState({
          status: result.data.items.length === 0 ? "empty" : "ready",
          data: result.data,
        });
        return;
      }

      if (result.error === "aborted") {
        return;
      }

      if (result.error === "unauthorized") {
        setState({ status: "unauthorized", data: null });
        void refreshUser();
        return;
      }

      setState({
        status: result.error === "rate-limit" ? "rate-limit" : "error",
        data: null,
      });
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [userId, loading, attempt, refreshUser]);

  return { status: state.status, data: state.data, retry, refresh };
}
