/** Vocabulario de géneros ya usado en la home (Action→Acción…, spec 002, D9). */
const GENRE_TRANSLATIONS: Record<string, string> = {
  Action: "Acción",
  Adventure: "Aventura",
  Animation: "Animación",
  Biography: "Biografía",
  Comedy: "Comedia",
  Crime: "Crimen",
  Documentary: "Documental",
  Drama: "Drama",
  Family: "Familiar",
  Fantasy: "Fantasía",
  History: "Historia",
  Horror: "Terror",
  Mystery: "Misterio",
  Romance: "Romance",
  "Sci-Fi": "Ciencia ficción",
  Sport: "Deporte",
  Thriller: "Suspenso",
  War: "Bélica",
  Western: "Western",
};

/**
 * Un chip por cada género movie del manifiesto de Cinemeta, en el orden de la
 * maqueta (spec 003, RF-7): 19 ids en inglés, los mismos que pinta la ficha.
 */
export const MOVIE_GENRES = [
  "Action",
  "Adventure",
  "Animation",
  "Biography",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Sport",
  "Thriller",
  "War",
  "Western",
] as const;

/**
 * Género en español para pintarlo en la ficha; sin equivalente se muestra
 * tal cual llega, sin inventar traducción (RF-3, caso 7).
 */
export function translateGenre(genre: string): string {
  return GENRE_TRANSLATIONS[genre] ?? genre;
}
