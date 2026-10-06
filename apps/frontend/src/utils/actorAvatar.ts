/**
 * Avatar tipográfico de actor (iniciales y color estable por
 * nombre): se usa en la card de la vista Actores y como
 * reserva de la foto de TMDB en el perfil.
 */

/** Paleta en clases literales para que Tailwind la incluya en el build. */
export const AVATAR_COLORS = [
  "bg-indigo-500/20 text-indigo-300",
  "bg-teal-500/20 text-teal-300",
  "bg-rose-500/20 text-rose-300",
  "bg-amber-500/20 text-amber-300",
  "bg-sky-500/20 text-sky-300",
  "bg-violet-500/20 text-violet-300",
];

/** Iniciales: primera letra del primer y último nombre (una sola → una). */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) ?? "" : "";

  return (first + last).toUpperCase();
}

/** Color estable por nombre: misma entrada, mismo avatar en cada carga. */
export function colorOf(name: string): string {
  let hash = 0;

  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }

  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]!;
}
