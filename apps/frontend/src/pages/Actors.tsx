import type { ReactNode } from "react";
import SectionError from "../components/home/SectionError";
import ActorCard from "../components/actors/ActorCard";
import { useActors } from "../hooks/useActors";
import { useActorList } from "../hooks/useActorList";
import { filterActorsByQuery, sortActors } from "../utils/actorsList";

function GridSkeleton() {
  return (
    <div
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      aria-hidden="true"
    >
      {Array.from({ length: 15 }, (_, position) => (
        <div
          key={position}
          className="h-44 animate-pulse rounded-xl bg-slate-800 [@media(prefers-reduced-motion:reduce)]:animate-none"
        />
      ))}
    </div>
  );
}

/** Vacío de lista y vacío de búsqueda con mensajes distintos. */
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
 * Vista Actores: una sola cuadrícula (5 columnas en escritorio) con los
 * actores de todas las películas. Ordenar por y Buscar viven en el sidebar y
 * actúan sobre la lista ya cargada: no se vuelve a pedir nada a Cinemeta.
 */
function Actors() {
  const { sort, query } = useActors();
  const { actors, status, retry } = useActorList();

  const visible = filterActorsByQuery(sortActors(actors, sort), query);

  return (
    <div className="space-y-6">
      <section aria-label="Actores" className="space-y-4">
        {status === "loading" && <GridSkeleton />}
        {status === "error" && <SectionError onRetry={retry} />}
        {status === "rate-limit" && <SectionError variant="limit" />}
        {status === "empty" && <EmptyBox>No hay actores disponibles</EmptyBox>}

        {status === "ready" && visible.length === 0 && (
          <EmptyBox>No encontramos actores que coincidan con tu búsqueda</EmptyBox>
        )}

        {status === "ready" && visible.length > 0 && (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visible.map((actor) => (
              <ActorCard key={actor.name} actor={actor} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default Actors;
