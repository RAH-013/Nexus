import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Outlet } from "react-router-dom";
import type { MediaType } from "../api/cinemeta";
import {
  apiGetReactions,
  apiSetReaction,
  type ReactionKind,
  type ReactionsError,
} from "../api/reactions";
import {
  ReactionsContext,
  type ReactionsContextType,
} from "../context/ReactionsContext";
import { useUser } from "../hooks/useUser";
import { toast } from "../utils/swal";

const TOGGLE_MESSAGES: Record<ReactionsError, string> = {
  aborted: "",
  unauthorized: "Tu sesión ha caducado. Inicia sesión de nuevo.",
  "rate-limit":
    "Se alcanzó el límite de peticiones. Vuelve a intentarlo en unos minutos.",
  timeout: "No se pudo guardar la reacción. Inténtalo de nuevo.",
  http: "No se pudo guardar la reacción. Inténtalo de nuevo.",
  network: "No se pudo guardar la reacción. Inténtalo de nuevo.",
};

interface ReactionsProviderProps {
  children?: ReactNode;
}

interface ReactionSets {
  favorites: ReadonlySet<string>;
  likes: ReadonlySet<string>;
  dislikes: ReadonlySet<string>;
}

/** Conjuntos compartidos: sin sesión no hay reacciones que mostrar (RF-1). */
const EMPTY_SETS: ReactionSets = {
  favorites: new Set(),
  likes: new Set(),
  dislikes: new Set(),
};

/** El set guardado pertenece a este usuario (evita ver las reacciones de otro). */
interface LoadedReactions {
  userId: string;
  sets: ReactionSets;
}

/**
 * Carga y conmuta FAVORITE / LIKE / DISLIKE de la ficha: dentro de
 * `UserProvider` (anidado en `ViewsProvider`), pide `GET /api/reactions`
 * cuando hay sesión. El estado solo cambia con la respuesta del servidor.
 */
export function ReactionsProvider({ children }: ReactionsProviderProps) {
  const { user, refreshUser } = useUser();
  const userId = user?.id ?? null;
  const [loaded, setLoaded] = useState<LoadedReactions | null>(null);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const pendingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let active = true;

    if (!userId) {
      return;
    }

    void apiGetReactions().then((result) => {
      if (!active) {
        return;
      }

      if (result.success) {
        setLoaded({
          userId,
          sets: {
            favorites: new Set(result.data.favorites),
            likes: new Set(result.data.likes),
            dislikes: new Set(result.data.dislikes),
          },
        });
        return;
      }

      // Sesión caducada entre revalidados: se vacía y se revalida ya (RF-1).
      if (result.error === "unauthorized") {
        setLoaded(null);
        void refreshUser();
      }
    });

    return () => {
      active = false;
    };
  }, [userId, refreshUser]);

  const sets =
    userId !== null && loaded?.userId === userId ? loaded.sets : EMPTY_SETS;

  const applyServerResult = useCallback(
    (kind: ReactionKind, id: string, on: boolean, owner: string): void => {
      setLoaded((current) => {
        const base = current?.userId === owner ? current.sets : EMPTY_SETS;
        const favorites = new Set(base.favorites);
        const likes = new Set(base.likes);
        const dislikes = new Set(base.dislikes);

        if (kind === "favorite") {
          if (on) {
            favorites.add(id);
          } else {
            favorites.delete(id);
          }
        } else if (kind === "like") {
          if (on) {
            likes.add(id);
            dislikes.delete(id);
          } else {
            likes.delete(id);
          }
        } else if (on) {
          dislikes.add(id);
          likes.delete(id);
        } else {
          dislikes.delete(id);
        }

        return { userId: owner, sets: { favorites, likes, dislikes } };
      });
    },
    [],
  );

  const setReaction = useCallback(
    async (
      kind: ReactionKind,
      type: MediaType,
      id: string,
      on: boolean,
    ): Promise<void> => {
      if (!userId) {
        return;
      }

      // Guardia síncrona: el doble clic no llega a lanzar dos peticiones.
      if (pendingRef.current.has(id)) {
        return;
      }

      pendingRef.current.add(id);
      setPendingIds(new Set(pendingRef.current));

      const result = await apiSetReaction(kind, type, id, on);

      pendingRef.current.delete(id);
      setPendingIds(new Set(pendingRef.current));

      if (result.success) {
        applyServerResult(kind, id, on, userId);
        return;
      }

      // 401: pérdida de sesión; el control se oculta cuando `user` pasa a null.
      if (result.error === "unauthorized") {
        setLoaded(null);
        void refreshUser();
      }

      // El estado visual no queda a medias: sin éxito, los sets no se tocan.
      if (result.error !== "aborted") {
        toast.fire({ icon: "error", title: TOGGLE_MESSAGES[result.error] });
      }
    },
    [userId, applyServerResult, refreshUser],
  );

  const toggleFavorite = useCallback(
    (type: MediaType, id: string) =>
      setReaction("favorite", type, id, !sets.favorites.has(id)),
    [setReaction, sets.favorites],
  );

  const toggleLike = useCallback(
    (type: MediaType, id: string) =>
      setReaction("like", type, id, !sets.likes.has(id)),
    [setReaction, sets.likes],
  );

  const toggleDislike = useCallback(
    (type: MediaType, id: string) =>
      setReaction("dislike", type, id, !sets.dislikes.has(id)),
    [setReaction, sets.dislikes],
  );

  const value = useMemo<ReactionsContextType>(
    () => ({
      isFavorite: (id: string) => sets.favorites.has(id),
      isLiked: (id: string) => sets.likes.has(id),
      isDisliked: (id: string) => sets.dislikes.has(id),
      isPending: (id: string) => pendingIds.has(id),
      toggleFavorite,
      toggleLike,
      toggleDislike,
      enabled: userId !== null,
    }),
    [sets, pendingIds, toggleFavorite, toggleLike, toggleDislike, userId],
  );

  return (
    <ReactionsContext.Provider value={value}>
      {children ?? <Outlet />}
    </ReactionsContext.Provider>
  );
}
