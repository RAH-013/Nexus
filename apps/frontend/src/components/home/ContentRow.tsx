import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-animated";
import type { Collection } from "../../api/cinemeta";
import { useSectionData } from "../../hooks/useSectionData";
import PosterCard from "./PosterCard";
import SectionError from "./SectionError";

interface ContentRowProps {
  /** Rótulo ya redactado en español (RF-4, RF-5). */
  title: string;
  collection: Collection;
}

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

/**
 * Fila con su carril horizontal: carga, error y límite independientes por
 * sección (RF-12, RF-13), controles según RF-6 y sin deduplicar títulos.
 */
function ContentRow({ title, collection }: ContentRowProps) {
  const { items, status, retry } = useSectionData(collection);
  const railRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  const measure = useCallback(() => {
    const rail = railRef.current;

    if (rail) {
      setOverflowing(rail.scrollWidth - rail.clientWidth > 2);
    }
  }, []);

  useEffect(() => {
    const rail = railRef.current;

    if (!rail) {
      return;
    }

    measure();
    rail.addEventListener("scroll", measure, { passive: true });

    const observer = new ResizeObserver(measure);
    observer.observe(rail);

    return () => {
      rail.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [measure, status, items.length]);

  if (status === "empty") {
    return null;
  }

  const scrollBy = (direction: 1 | -1) => {
    const rail = railRef.current;

    if (!rail) {
      return;
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    rail.scrollBy({
      left: direction * rail.clientWidth * 0.8,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  };

  return (
    <section aria-label={title} className="space-y-3">
      <h2 className="text-lg font-semibold sm:text-xl">{title}</h2>

      {status === "loading" && <RowSkeleton />}

      {status === "error" && <SectionError onRetry={retry} />}

      {status === "rate-limit" && <SectionError variant="limit" />}

      {status === "ready" && (
        <div className="group relative">
          <div
            ref={railRef}
            tabIndex={0}
            aria-label={`Desplazar la fila ${title}`}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") {
                event.preventDefault();
                scrollBy(1);
              }

              if (event.key === "ArrowLeft") {
                event.preventDefault();
                scrollBy(-1);
              }
            }}
            className="flex gap-3 overflow-x-auto pb-1 outline-none [scrollbar-width:none] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 [&::-webkit-scrollbar]:hidden"
          >
            {items.map((item, position) => (
              <div key={`${item.id}-${position}`} className="w-40 shrink-0 space-y-1">
                <PosterCard
                  item={item}
                  className="h-60 w-40"
                  eager={position < 6}
                />
                <p className="truncate text-sm text-slate-300">{item.name}</p>
                {item.year && <p className="text-xs text-slate-500">{item.year}</p>}
              </div>
            ))}
          </div>

          {overflowing && (
            <>
              <button
                type="button"
                aria-label="Desplazar la fila hacia la izquierda"
                onClick={() => scrollBy(-1)}
                className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-slate-900/80 p-2 text-white opacity-0 transition-opacity hover:bg-slate-700 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
              >
                <ChevronLeftIcon size={20} animateOnHover={false} aria-hidden="true" />
              </button>

              <button
                type="button"
                aria-label="Desplazar la fila hacia la derecha"
                onClick={() => scrollBy(1)}
                className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-slate-900/80 p-2 text-white opacity-0 transition-opacity hover:bg-slate-700 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
              >
                <ChevronRightIcon size={20} animateOnHover={false} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

export default ContentRow;
