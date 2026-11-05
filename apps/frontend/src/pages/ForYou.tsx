import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { SparklesIcon } from "lucide-animated";
import type { ForYouItem } from "../api/recommendations";
import SectionError from "../components/home/SectionError";
import { useForYou } from "../hooks/useForYou";
import { useInteractions } from "../hooks/useInteractions";

/** Vacío de la página: la misma caja que «Recientes». */
function EmptyBox({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="flex min-h-40 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/60 px-6 py-10 text-center text-sm text-slate-300"
    >
      {children}
    </div>
  );
}

/** Rejilla de esqueletos mientras carga o recalcula. */
function GridSkeleton() {
  return (
    <ul
      aria-hidden="true"
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
    >
      {Array.from({ length: 8 }, (_, position) => (
        <li key={position} className="animate-pulse [@media(prefers-reduced-motion:reduce)]:animate-none">
          <div className="aspect-2/3 rounded-xl bg-slate-800" />
          <div className="mt-3 h-4 w-3/4 rounded bg-slate-800" />
          <div className="mt-2 h-3 w-full rounded bg-slate-800" />
        </li>
      ))}
    </ul>
  );
}

/** Póster con reserva si falla la carga. */
function Poster({ item }: { item: ForYouItem }) {
  const [broken, setBroken] = useState(false);
  const withImage = Boolean(item.poster) && !broken;

  return withImage ? (
    <img
      src={item.poster}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
      className="aspect-2/3 w-full rounded-xl object-cover"
    />
  ) : (
    <span
      role="img"
      aria-label={`Sin póster de ${item.name}`}
      className="flex aspect-2/3 w-full items-center justify-center rounded-xl bg-slate-800 text-slate-600"
    >
      <SparklesIcon size={32} animateOnHover={false} aria-hidden="true" />
    </span>
  );
}

/** Tarjeta de recomendación con puntuación, razón y opción para descartar. */
function ForYouCard({ item }: { item: ForYouItem }) {
  const { toggleNotInterested, isPending, enabled } = useInteractions();
  const pending = isPending(item.id);

  return (
    <li className="flex flex-col justify-between rounded-xl border border-slate-700/50 bg-slate-800/30 p-2.5 transition-colors hover:border-slate-600 hover:bg-slate-800/60">
      <Link
        to={`/title/${item.type}/${encodeURIComponent(item.id)}`}
        aria-label={`Ver ficha de ${item.name}`}
        className="group block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
      >
        <span className="relative block">
          <Poster item={item} />
          <span className="absolute top-2 right-2 rounded-lg bg-slate-950/80 px-2 py-1 text-xs font-bold text-white backdrop-blur-sm">
            {Math.round(item.score)}
          </span>
        </span>

        <span className="mt-2.5 block truncate text-sm font-semibold text-white group-hover:text-indigo-300">
          {item.name}
        </span>
        <span className="mt-0.5 block text-xs text-slate-500">
          {item.type === "movie" ? "Película" : "Serie"}
          {item.year ? ` · ${item.year}` : ""}
        </span>
        <span className="mt-1.5 block text-xs leading-5 text-slate-400 line-clamp-2">
          {item.reason}
        </span>
      </Link>

      {enabled && (
        <div className="mt-3 pt-2 border-t border-slate-700/40">
          <button
            type="button"
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              void toggleNotInterested(item.type, item.id);
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1 text-[11px] text-slate-400 transition-colors hover:bg-slate-700 hover:text-amber-300 focus-visible:outline-2 focus-visible:outline-indigo-400 disabled:opacity-50"
            title="Descartar este título para no recibir sugerencias similares"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-3 w-3"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            No me interesa
          </button>
        </div>
      )}
    </li>
  );
}

/**
 * «Para ti»: recomendaciones personalizadas basadas en interacciones múltiples.
 */
function ForYou() {
  const { status, data, retry, refresh } = useForYou();
  const { isNotInterested, recordImpressions } = useInteractions();
  const refreshing = status === "loading";

  // Registrar impresiones cuando se reciben recomendaciones
  useEffect(() => {
    if (status === "ready" && data?.items?.length) {
      recordImpressions(
        data.items.map((item) => ({ type: item.type, id: item.id })),
      );
    }
  }, [status, data, recordImpressions]);

  // Filtrar títulos que el usuario haya descartado activamente
  const visibleItems =
    data?.items?.filter((item) => !isNotInterested(item.id)) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="max-w-xl text-sm text-slate-400">
            Títulos seleccionados con base en tus valoraciones, calificaciones,
            favoritos y opiniones.
          </p>
          {data?.source === "cold-start" && (
            <p className="mt-1 text-xs text-indigo-400">
              Sugerencias populares para comenzar a explorar y calibrar tus preferencias.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
        >
          {refreshing ? "Actualizando…" : "Actualizar recomendaciones"}
        </button>
      </div>

      {status === "loading" && <GridSkeleton />}

      {status === "error" && <SectionError onRetry={retry} />}

      {status === "rate-limit" && <SectionError variant="limit" />}

      {status === "unauthorized" && (
        <p className="text-sm text-slate-400">
          Tu sesión ha caducado. Inicia sesión de nuevo.
        </p>
      )}

      {status === "empty" && (
        <EmptyBox>
          Marca títulos como vistos, califícalos con estrellas o indica qué te gusta para que podamos recomendarte contenido personalizado.
        </EmptyBox>
      )}

      {status === "ready" && visibleItems.length === 0 && (
        <EmptyBox>
          Has descartado las recomendaciones actuales. Haz clic en «Actualizar recomendaciones» para generar nuevas sugerencias.
        </EmptyBox>
      )}

      {status === "ready" && visibleItems.length > 0 && (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visibleItems.map((item) => (
            <ForYouCard key={`${item.type}:${item.id}`} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

export default ForYou;
