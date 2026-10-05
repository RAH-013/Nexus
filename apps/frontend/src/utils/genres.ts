/** Vocabulario de géneros ya usado en la home (Action→Acción…, spec 002, D9). */
const GENRE_TRANSLATIONS: Record<string, string> = {
  Action: "Acción",
  Adventure: "Aventura",
  Animation: "Animación",
  Comedy: "Comedia",
  Crime: "Crimen",
  Documentary: "Documental",
  Drama: "Drama",
  Family: "Familiar",
  Fantasy: "Fantasía",
  Horror: "Terror",
  Mystery: "Misterio",
  Romance: "Romance",
  "Sci-Fi": "Ciencia ficción",
  Thriller: "Suspenso",
  War: "Bélica",
  Western: "Western",
};

/**
 * Género en español para pintarlo en la ficha; sin equivalente se muestra
 * tal cual llega, sin inventar traducción (RF-3, caso 7).
 */
export function translateGenre(genre: string): string {
  return GENRE_TRANSLATIONS[genre] ?? genre;
}
