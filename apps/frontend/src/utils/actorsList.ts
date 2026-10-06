import type { ActorEntry } from "../api/cinemeta";

/** Orden de la vista Actores: recuento de películas o alfabético. */
export type ActorsSort = "count" | "name";

const byName = (a: ActorEntry, b: ActorEntry) => a.name.localeCompare(b.name, "es");

/** Más películas primero (por defecto); con «name», alfabético en español. */
export function sortActors(actors: ActorEntry[], sort: ActorsSort): ActorEntry[] {
  if (sort === "name") {
    return [...actors].sort(byName);
  }

  return [...actors].sort((a, b) => b.movieCount - a.movieCount || byName(a, b));
}

/** Búsqueda de actores en la vista: por nombre, insensible a mayúsculas. */
export function filterActorsByQuery(
  actors: ActorEntry[],
  query: string,
): ActorEntry[] {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return actors;
  }

  return actors.filter((actor) => actor.name.toLowerCase().includes(normalized));
}
