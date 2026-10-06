import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Outlet } from "react-router-dom";
import {
  apiGetViews,
  apiMarkTitleViewed,
  apiUnmarkTitleViewed,
  type MediaType,
  type ViewsError,
} from "../api/views";
import { ViewsContext, type ViewsContextType } from "../context/ViewsContext";
import { useUser } from "../hooks/useUser";
import { toast } from "../utils/swal";

const TOGGLE_MESSAGES: Record<ViewsError, string> = {
  aborted: "",
  unauthorized: "Tu sesión ha caducado. Inicia sesión de nuevo.",
  "rate-limit":
    "Se alcanzó el límite de peticiones. Vuelve a intentarlo en unos minutos.",
  timeout: "No se pudo actualizar la película. Inténtalo de nuevo.",
  http: "No se pudo actualizar la película. Inténtalo de nuevo.",
  network: "No se pudo actualizar la película. Inténtalo de nuevo.",
};

interface ViewsProviderProps {
  children?: ReactNode;
}

/** Set vacío compartido: sin sesión no hay vistos que mostrar (RF-8). */
const EMPTY_IDS: ReadonlySet<string> = new Set();

/** El set guardado pertenece a este usuario (evita ver los vistos de otro). */
interface LoadedViews {
  userId: string;
  ids: ReadonlySet<string>;
}

/**
 * Carga y conmuta los `VIEW` de películas (spec 003, D6): dentro de
 * `UserProvider`, se pide `GET /api/views` cuando hay sesión (por id, para que
 * el revalidado del poll no re-pida la lista). El set expuesto se deriva del
 * usuario actual: sin sesión o antes de cargar se muestra vacío. El toggle
 * espera la respuesta antes de tocar el set (sin optimista) y un ref serializa
 * los clics de la misma película para que no haya dos `VIEW` a la vez.
 */
export function ViewsProvider({ children }: ViewsProviderProps) {
  const { user, refreshUser } = useUser();
  const userId = user?.id ?? null;
  const [loaded, setLoaded] = useState<LoadedViews | null>(null);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set());
  const pendingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let active = true;

    if (!userId) {
      return;
    }

    void apiGetViews().then((result) => {
      if (!active) {
        return;
      }

      if (result.success) {
        setLoaded({ userId, ids: new Set(result.data.ids) });
        return;
      }

      // Sesión caducada entre revalidados: se vacía y se revalida ya (RF-8).
      if (result.error === "unauthorized") {
        setLoaded(null);
        void refreshUser();
      }
    });

    return () => {
      active = false;
    };
  }, [userId, refreshUser]);

  const viewedIds =
    userId !== null && loaded?.userId === userId ? loaded.ids : EMPTY_IDS;

  const toggle = useCallback(
    async (id: string, type: MediaType = "movie"): Promise<void> => {
      if (!userId) {
        return;
      }

      // Guardia síncrona: el doble clic no llega a lanzar dos peticiones
      // (caso 9) y el estado solo cambia con la respuesta del servidor.
      if (pendingRef.current.has(id)) {
        return;
      }

      pendingRef.current.add(id);
      setPendingIds(new Set(pendingRef.current));

      const marking = !viewedIds.has(id);
      // El tipo viaja hasta el backend (PUT/DELETE /api/views/:type/:id),
      // así una serie se guarda como serie y no como película.
      const result = marking
        ? await apiMarkTitleViewed(type, id)
        : await apiUnmarkTitleViewed(type, id);

      pendingRef.current.delete(id);
      setPendingIds(new Set(pendingRef.current));

      if (result.success) {
        setLoaded((current) => {
          const next = new Set(current?.userId === userId ? current.ids : EMPTY_IDS);

          if (marking) {
            next.add(id);
          } else {
            next.delete(id);
          }

          return { userId, ids: next };
        });

        return;
      }

      // 401: pérdida de sesión; el control se oculta cuando `user` pasa a null.
      if (result.error === "unauthorized") {
        setLoaded(null);
        void refreshUser();
      }

      // «El estado visual no queda a medias»: sin éxito, el set no se toca.
      if (result.error !== "aborted") {
        toast.fire({ icon: "error", title: TOGGLE_MESSAGES[result.error] });
      }
    },
    [userId, viewedIds, refreshUser],
  );

  const value = useMemo<ViewsContextType>(
    () => ({
      viewedIds,
      isViewed: (id: string) => viewedIds.has(id),
      isPending: (id: string) => pendingIds.has(id),
      toggle,
      enabled: userId !== null,
    }),
    [viewedIds, pendingIds, toggle, userId],
  );

  return (
    <ViewsContext.Provider value={value}>
      {children ?? <Outlet />}
    </ViewsContext.Provider>
  );
}