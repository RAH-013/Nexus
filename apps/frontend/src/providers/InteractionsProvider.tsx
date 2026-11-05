import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Outlet } from "react-router-dom";
import type { MediaType } from "../api/cinemeta";
import {
  apiListNotInterested,
  apiListUserRatings,
  apiRecordDetailView,
  apiRecordImpressions,
  apiSetNotInterested,
  apiSetUserRating,
  type ImpressionItem,
} from "../api/interactions";
import {
  InteractionsContext,
  type InteractionsContextType,
} from "../context/InteractionsContext";
import { useUser } from "../hooks/useUser";
import { toast } from "../utils/swal";

interface InteractionsProviderProps {
  children?: ReactNode;
}

export function InteractionsProvider({ children }: InteractionsProviderProps) {
  const { user } = useUser();
  const enabled = Boolean(user);

  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [notInterestedSet, setNotInterestedSet] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  // Cargar estado inicial cuando hay usuario autenticado
  useEffect(() => {
    if (!enabled) {
      setRatings({});
      setNotInterestedSet(new Set());
      return;
    }

    let isCurrent = true;

    Promise.allSettled([apiListUserRatings(), apiListNotInterested()]).then(
      ([ratingsRes, notInterestedRes]) => {
        if (!isCurrent) return;
        if (ratingsRes.status === "fulfilled") {
          setRatings(ratingsRes.value);
        }
        if (notInterestedRes.status === "fulfilled") {
          setNotInterestedSet(new Set(notInterestedRes.value));
        }
      },
    );

    return () => {
      isCurrent = false;
    };
  }, [enabled, user?.id]);

  const markPending = useCallback((id: string, pending: boolean) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (pending) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const getRating = useCallback(
    (id: string): number | null => {
      return ratings[id] ?? null;
    },
    [ratings],
  );

  const setRating = useCallback(
    async (type: MediaType, id: string, value: number): Promise<boolean> => {
      if (!enabled || pendingIds.has(id)) {
        return false;
      }

      markPending(id, true);
      const res = await apiSetUserRating(type, id, value);
      markPending(id, false);

      if (res.ok) {
        setRatings((prev) => {
          const next = { ...prev };
          if (value > 0) {
            next[id] = value;
          } else {
            delete next[id];
          }
          return next;
        });
        toast.fire({
          icon: "success",
          title: value > 0 ? `Valoraste con ${value} estrellas` : "Calificación eliminada",
        });
        return true;
      } else {
        toast.fire({
          icon: "error",
          title: res.message || "No se pudo guardar la calificación",
        });
        return false;
      }
    },
    [enabled, pendingIds, markPending],
  );

  const isNotInterested = useCallback(
    (id: string): boolean => {
      return notInterestedSet.has(id);
    },
    [notInterestedSet],
  );

  const toggleNotInterested = useCallback(
    async (type: MediaType, id: string): Promise<boolean> => {
      if (!enabled || pendingIds.has(id)) {
        return false;
      }

      const currentlyOn = notInterestedSet.has(id);
      const targetState = !currentlyOn;

      markPending(id, true);
      const res = await apiSetNotInterested(type, id, targetState);
      markPending(id, false);

      if (res.ok) {
        setNotInterestedSet((prev) => {
          const next = new Set(prev);
          if (targetState) {
            next.add(id);
          } else {
            next.delete(id);
          }
          return next;
        });
        toast.fire({
          icon: "info",
          title: targetState
            ? "Título descartado. Ajustaremos tus recomendaciones"
            : "Descarte eliminado",
        });
        return true;
      } else {
        toast.fire({
          icon: "error",
          title: res.message || "No se pudo actualizar el descarte",
        });
        return false;
      }
    },
    [enabled, notInterestedSet, pendingIds, markPending],
  );

  const recordDetail = useCallback(
    (type: MediaType, id: string) => {
      if (!enabled) return;
      void apiRecordDetailView(type, id);
    },
    [enabled],
  );

  const recordImpressions = useCallback(
    (items: ImpressionItem[]) => {
      if (!enabled || items.length === 0) return;
      void apiRecordImpressions(items);
    },
    [enabled],
  );

  const isPending = useCallback(
    (id: string) => pendingIds.has(id),
    [pendingIds],
  );

  const value = useMemo<InteractionsContextType>(
    () => ({
      getRating,
      setRating,
      isNotInterested,
      toggleNotInterested,
      recordDetail,
      recordImpressions,
      isPending,
      enabled,
    }),
    [
      getRating,
      setRating,
      isNotInterested,
      toggleNotInterested,
      recordDetail,
      recordImpressions,
      isPending,
      enabled,
    ],
  );

  return (
    <InteractionsContext.Provider value={value}>
      {children ?? <Outlet />}
    </InteractionsContext.Provider>
  );
}
