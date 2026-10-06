import type { ReactNode } from "react";
import type { SeriesList } from "../api/cinemeta";
import SectionError from "../components/home/SectionError";
import SeriesCard from "../components/series/SerieCard";
import { useSeries } from "../hooks/useSeries";
import { useSeriesList } from "../hooks/useSeriesList";
import { useViews } from "../hooks/useViews";
import { filterByGenre, filterByViewed, sortSeries } from "../utils/seriesList";

/** Orden de pestañas de izquierda a derecha para Series. */
const TABS: { list: SeriesList; label: string }[] = [
  { list: "trending", label: "Populares" },
  { list: "playing", label: "En emisión" },
  { list: "upcoming", label: "Próximas" },
  { list: "rated", label: "Mejor calificadas" },
];

function GridSkeleton() {
  return (
    <div
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6"
      aria-hidden="true"
    >
      {Array.from({ length: 12 }, (_, position) => (
        <div
          key={position}
          className="aspect-2/3 animate-pulse rounded-lg bg-slate-800 [@media(prefers-reduced-motion:reduce)]:animate-none"
        />
      ))}
    </div>
  );
}

/** Vacío de lista y vacío de filtro con mensajes distintos. */
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

/**
 * Vista Series: cuatro pestañas con una lista cada una en cuadrícula, Ordenar
 * y Filtros compartidos con el sidebar y estados independientes por lista.
 */
function Series() {
  const { list, setList, sort, genre, show } = useSeries();
  const { viewedIds } = useViews();
  const { items, status, retry } = useSeriesList(list);

  // Ordenar y Filtros actúan sobre la lista de la pestaña activa ya cargada:
  // no se vuelve a pedir nada a Cinemeta por filtrar u ordenar.
  const visible = sortSeries(
    filterByViewed(filterByGenre(items, genre), show, viewedIds),
    sort,
  );

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Listas de series"
        className="flex flex-wrap gap-2"
      >
        {TABS.map((tab) => (
          <button
            key={tab.list}
            type="button"
            role="tab"
            id={`series-tab-${tab.list}`}
            aria-selected={list === tab.list}
            aria-controls="series-grid"
            onClick={() => setList(tab.list)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 ${
              list === tab.list
                ? "bg-indigo-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section
        id="series-grid"
        role="tabpanel"
        aria-labelledby={`series-tab-${list}`}
        className="space-y-4"
      >
        {status === "loading" && <GridSkeleton />}
        {status === "error" && <SectionError onRetry={retry} />}
        {status === "rate-limit" && <SectionError variant="limit" />}
        {status === "empty" && <EmptyBox>No hay series en esta lista</EmptyBox>}

        {status === "ready" && visible.length === 0 && (
          <EmptyBox>Ninguna serie coincide con los filtros</EmptyBox>
        )}

        {status === "ready" && visible.length > 0 && (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {visible.map((item, position) => (
              <li key={`${item.id}-${position}`} className="min-w-0">
                <SeriesCard item={item} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default Series;