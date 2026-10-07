import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { ActivityApiResult, ActivityOrder } from "../api/activity";

export type InfiniteStatus =
  | "loading" // primera página
  | "ready" // al día (puede quedar más)
  | "error"
  | "rate-limit"
  | "unauthorized";

export interface ActivityPage<T> {
  items: T[];
  nextCursor: string | null;
}

interface InfiniteState<T> {
  items: T[];
  status: InfiniteStatus;
  /**
   * Ref del «centinela»: ponlo en el div que cierra la fila. Al entrar
   * en pantalla (con 400 px de margen) se pide la página siguiente.
   */
  sentinelRef: RefObject<HTMLDivElement | null>;
  /** Repite la página que falló. */
  retry: () => void;
}

/** Lo guardado pertenece a otro orden (`order`). */
interface LoadedRows<T> {
  order: ActivityOrder;
  items: T[];
  status: InfiniteStatus;
}

/**
 * Scroll infinito de una fila de actividad.
 *
 * `load` recibe el cursor de la página a pedir (`null` = primera) y la
 * señal para cancelar. Cambiar `order` reinicia la fila desde el principio.
 */
export function useInfiniteActivity<T>(
  load: (
    cursor: string | null,
    signal: AbortSignal,
  ) => Promise<ActivityApiResult<ActivityPage<T>>>,
  order: ActivityOrder,
): InfiniteState<T> {
  const [loaded, setLoaded] = useState<LoadedRows<T>>({
    order,
    items: [],
    status: "loading",
  });
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Estado de trabajo en refs: el observer vive toda la vida del
  // componente, pero siempre debe actuar con los valores de ahora.
  const cursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const loadRef = useRef(load);

  // La función `load` la crea la página y cambia con el orden; guardarla
  // en una ref evita re-crear el observer a cada cambio. Este efecto va
  // ANTES del reinicio para que la primera petición ya use la función nueva.
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  const loadPage = useCallback(
    async (
      cursor: string | null,
      signal: AbortSignal,
      pageOrder: ActivityOrder,
    ) => {
      loadingRef.current = true;
      const result = await loadRef.current(cursor, signal);
      loadingRef.current = false;

      // La fila se reinició o se desmontó mientras se pedía.
      if (signal.aborted) {
        return;
      }

      if (!result.success) {
        setLoaded((current) => ({
          order: pageOrder,
          items: cursor === null ? [] : current.items,
          status:
            result.error === "unauthorized"
              ? "unauthorized"
              : result.error === "rate-limit"
                ? "rate-limit"
                : "error",
        }));

        return;
      }

      setLoaded((current) => ({
        order: pageOrder,
        items:
          cursor === null
            ? result.data.items
            : [...current.items, ...result.data.items],
        status: "ready",
      }));

      cursorRef.current = result.data.nextCursor;
      hasMoreRef.current = result.data.nextCursor !== null;
    },
    [],
  );

  /** Pide la página del cursor actual, si no hay una en vuelo. */
  const startLoad = useCallback(
    (cursor: string | null, pageOrder: ActivityOrder) => {
      if (loadingRef.current || !hasMoreRef.current) {
        return;
      }

      // Cancela la petición anterior (cambio de orden o desmontaje).
      abortRef.current?.abort();

      const controller = new AbortController();
      abortRef.current = controller;

      void loadPage(cursor, controller.signal, pageOrder);
    },
    [loadPage],
  );

  // Primera carga y reinicio al cambiar el orden: se limpian las refs y
  // se pide la primera página. El contenido se deriva del orden guardado
  // (ver `stale` al final), sin tocar estado de forma síncrona aquí.
  useEffect(() => {
    abortRef.current?.abort();
    cursorRef.current = null;
    hasMoreRef.current = true;
    loadingRef.current = false;
    startLoad(null, order);
  }, [order, startLoad]);

  // Cancela la petición en vuelo al salir de la página.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Centinela: entra en pantalla → siguiente página.
  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          startLoad(cursorRef.current, order);
        }
      },
      { rootMargin: "400px" },
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [startLoad, order]);

  const retry = useCallback(() => {
    setLoaded((current) => ({ ...current, status: "loading" }));
    startLoad(cursorRef.current, order);
  }, [startLoad, order]);

  // Otro orden = fila distinta: mientras no llegue su primera página,
  // la fila se muestra vacía y cargando (mismo patrón que useComments).
  const stale = loaded.order !== order;

  return {
    items: stale ? [] : loaded.items,
    status: stale ? "loading" : loaded.status,
    sentinelRef,
    retry,
  };
}
