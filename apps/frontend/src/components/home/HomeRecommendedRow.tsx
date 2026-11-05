import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeftIcon, ChevronRightIcon, SparklesIcon } from "lucide-animated";
import { useForYou } from "../../hooks/useForYou";
import { useUser } from "../../hooks/useUser";
import { useInteractions } from "../../hooks/useInteractions";

function RowSkeleton() {
  return (
    <div className="flex gap-3" aria-hidden="true">
      {Array.from({ length: 6 }, (_, position) => (
        <div
          key={position}
          className="h-60 w-40 shrink-0 animate-pulse rounded-lg bg-slate-800 [@media(prefers-reduced-motion:reduce)]:animate-none"
        />
      ))}
    </div>
  );
}

export default function HomeRecommendedRow() {
  const { user } = useUser();
  const { status, data } = useForYou();
  const { isNotInterested } = useInteractions();
  const railRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  const measure = useCallback(() => {
    const rail = railRef.current;
    if (rail) {
      setOverflowing(rail.scrollWidth - rail.clientWidth > 2);
    }
  }, []);

  const items = (data?.items ?? []).filter((item) => !isNotInterested(item.id));

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    measure();
    rail.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(rail);

    return () => {
      rail.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [measure, status, items.length]);

  if (!user || status === "empty" || status === "error" || status === "unauthorized") {
    return null;
  }

  if (status === "loading") {
    return (
      <section aria-label="Recomendado para ti" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold sm:text-xl">Recomendado para ti</h2>
        </div>
        <RowSkeleton />
      </section>
    );
  }

  if (items.length === 0) {
    return null;
  }

  const scrollBy = (direction: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rail.scrollBy({
      left: direction * rail.clientWidth * 0.8,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  };

  return (
    <section aria-label="Recomendado para ti" className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-white sm:text-xl flex items-center gap-2">
            <SparklesIcon size={20} className="text-indigo-400" />
            Recomendado para ti
          </h2>
          <span className="text-xs text-slate-400 hidden sm:inline">
            — Según lo que has visto y valorado
          </span>
        </div>
        <Link
          to="/for-you"
          className="text-xs font-medium text-indigo-400 transition-colors hover:text-indigo-300"
        >
          Ver todas
        </Link>
      </div>

      <div className="group relative">
        <div
          ref={railRef}
          tabIndex={0}
          aria-label="Desplazar la fila Recomendado para ti"
          className="no-scrollbar flex gap-3 overflow-x-auto scroll-smooth focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-400"
        >
          {items.map((item) => (
            <Link
              key={`${item.type}:${item.id}`}
              to={`/title/${item.type}/${encodeURIComponent(item.id)}`}
              aria-label={`Ver ${item.name}`}
              className="group/card relative block h-64 w-44 shrink-0 overflow-hidden rounded-xl border border-slate-700/60 bg-slate-800 focus-visible:outline-2 focus-visible:outline-indigo-400"
            >
              {item.poster ? (
                <img
                  src={item.poster}
                  alt={item.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover/card:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-slate-800 text-slate-600">
                  <SparklesIcon size={32} />
                </div>
              )}

              {/* Score badge */}
              <span className="absolute top-2 right-2 rounded-md bg-slate-950/85 px-1.5 py-0.5 text-[11px] font-bold text-white backdrop-blur-sm">
                {Math.round(item.score)}
              </span>

              {/* Degradado inferior con título y razón */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent p-2.5 pt-6 text-left">
                <span className="block truncate text-xs font-semibold text-white group-hover/card:text-indigo-300">
                  {item.name}
                </span>
                <span className="block truncate text-[11px] text-slate-400">
                  {item.reason}
                </span>
              </div>
            </Link>
          ))}
        </div>

        {overflowing && (
          <>
            <button
              type="button"
              aria-label="Desplazar a la izquierda"
              onClick={() => scrollBy(-1)}
              className="absolute top-1/2 -left-3 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/90 text-white shadow-lg backdrop-blur transition-opacity hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-indigo-400 opacity-0 group-hover:opacity-100"
            >
              <ChevronLeftIcon size={20} />
            </button>

            <button
              type="button"
              aria-label="Desplazar a la derecha"
              onClick={() => scrollBy(1)}
              className="absolute top-1/2 -right-3 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/90 text-white shadow-lg backdrop-blur transition-opacity hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-indigo-400 opacity-0 group-hover:opacity-100"
            >
              <ChevronRightIcon size={20} />
            </button>
          </>
        )}
      </div>
    </section>
  );
}
