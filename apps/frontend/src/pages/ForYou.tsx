import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { SparklesIcon } from "lucide-animated";
import type { ForYouItem } from "../api/recommendations";
import SectionError from "../components/home/SectionError";
import { useForYou } from "../hooks/useForYou";

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

/** Rejilla de esqueletos mientras carga o recalcula (RF-13, RF-14). */
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

/** Póster con reserva (icono si no hay o si falla), como en «Recientes». */
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

/** Tarjeta de recomendación: puntuación sobre el póster y razón debajo. */
function ForYouCard({ item }: { item: ForYouItem }) {
  return (
    <li>
      <Link
        to={`/title/${item.type}/${encodeURIComponent(item.id)}`}
        aria-label={`Ver ficha de ${item.name}`}
        className="group block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
      >
        <span className="relative block">
          <Poster item={item} />
          {/* Score visible (RF-13): entero 0–100 sobre el póster. */}
          <span className="absolute top-2 right-2 rounded-lg bg-slate-950/80 px-2 py-1 text-xs font-bold text-white backdrop-blur-sm">
            {Math.round(item.score)}
          </span>
        </span>

        <span className="mt-3 block truncate text-sm font-semibold text-white group-hover:text-indigo-300">
          {item.name}
        </span>
        <span className="mt-0.5 block text-xs text-slate-500">
          {item.type === "movie" ? "Película" : "Serie"}
          {item.year ? ` · ${item.year}` : ""}
        </span>
        {/* La razón en español va debajo del nombre (RF-13). */}
        <span className="mt-1.5 block text-xs leading-5 text-slate-400">
          {item.reason}
        </span>
      </Link>
    </li>
  );
}

/**
 * «Para ti» (spec 004): recomendaciones privadas de `GET
 * /api/recommendations/for-you`. El título de la página lo pone la cabecera
 * (el `handle` de la ruta); sin entrada de menú todavía (RF-11).
 */
function ForYou() {
  const { status, data, retry, refresh } = useForYou();
  const refreshing = status === "loading";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-slate-400">
          Títulos elegidos según lo que has visto, lo que te gusta y tus
          comentarios.
        </p>

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
          Marca títulos como vistos o dale me gusta a algo para que podamos
          recomendarte
        </EmptyBox>
      )}

      {status === "ready" && data && (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {data.items.map((item) => (
            <ForYouCard key={`${item.type}:${item.id}`} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

export default ForYou;
