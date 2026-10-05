import type { MediaItem } from "../api/cinemeta";

/** Criterios del menú Ordenar (spec 003, RF-6). */
export type MovieSort = "source" | "date" | "name";

/** Opciones del bloque Mostrar, solo con sesión (spec 003, RF-8). */
export type MovieShow = "all" | "unwatched" | "watched";

/** Mayúsculas, acentos y espacios sobrantes fuera (mismo criterio que la búsqueda, 001 RF-7). */
function normalize(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseYear(year?: string): number | null {
  if (!year) {
    return null;
  }

  const value = Number(year);

  return Number.isFinite(value) ? value : null;
}

/**
 * Ordena la lista **ya filtrada** sin volver a pedir nada a Cinemeta (RF-6):
 * `source` conserva el orden de la fuente; `date` pone el año más reciente
 * primero y el que no tenga año al final; `name` ordena A–Z.
 * Los sorts de `Array` son estables: los empates conservan el orden previo.
 */
export function sortMovies(items: readonly MediaItem[], sort: MovieSort): MediaItem[] {
  if (sort === "source") {
    return [...items];
  }

  if (sort === "date") {
    return [...items].sort((first, second) => {
      const firstYear = parseYear(first.year);
      const secondYear = parseYear(second.year);

      if (firstYear === null && secondYear === null) {
        return 0;
      }

      if (firstYear === null) {
        return 1;
      }

      if (secondYear === null) {
        return -1;
      }

      return secondYear - firstYear;
    });
  }

  return [...items].sort((first, second) =>
    normalize(first.name).localeCompare(normalize(second.name), "es"),
  );
}

/**
 * Filtro de género: un título entra si alguno de sus `genres` coincide con el
 * chip activo (comparación insensible a mayúsculas). Sin `genres` no entra
 * (spec 003, RF-7); `null` devuelve la lista tal cual.
 */
export function filterByGenre(items: readonly MediaItem[], genre: string | null): MediaItem[] {
  if (!genre) {
    return [...items];
  }

  const target = genre.toLowerCase();

  return items.filter((item) =>
    item.genres?.some((itemGenre) => itemGenre.toLowerCase() === target),
  );
}

/**
 * Filtro Mostrar sobre el set de vistos del usuario (spec 003, RF-8):
 * `watched` = el id está en el set; `unwatched`, lo contrario.
 */
export function filterByViewed(
  items: readonly MediaItem[],
  show: MovieShow,
  viewedIds: ReadonlySet<string>,
): MediaItem[] {
  if (show === "all") {
    return [...items];
  }

  const wantViewed = show === "watched";

  return items.filter((item) => viewedIds.has(item.id) === wantViewed);
}