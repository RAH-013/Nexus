/** Vocabulario de géneros usado en la home, películas y series. */
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
 * Un chip por cada género movie/series del manifiesto de Cinemeta, en el orden de la
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

/** Alias para mantener semántica clara en la vista de Series */
export const SERIES_GENRES = MOVIE_GENRES;

/**
 * Género en español para pintarlo en la ficha o chips; sin equivalente se muestra
 * tal cual llega, sin inventar traducción.
 */
export function translateGenre(genre: string): string {
  return GENRE_TRANSLATIONS[genre] ?? genre;
}