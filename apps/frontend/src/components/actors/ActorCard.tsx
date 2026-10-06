import type { ActorEntry } from "../../api/cinemeta";

/**
 * Card de la cuadrícula de Actores: avatar con iniciales, nombre y recuento
 * de películas. Cinemeta no da fotos de personas, así que el avatar es
 * tipográfico (hueco para foto cuando se conecte TMDB) y de momento la card
 * no tiene destino.
 */

/** Paleta en clases literales para que Tailwind la incluya en el build. */
const AVATAR_COLORS = [
  "bg-indigo-500/20 text-indigo-300",
  "bg-teal-500/20 text-teal-300",
  "bg-rose-500/20 text-rose-300",
  "bg-amber-500/20 text-amber-300",
  "bg-sky-500/20 text-sky-300",
  "bg-violet-500/20 text-violet-300",
];

/** Iniciales: primera letra del primer y último nombre (una sola → una). */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) ?? "" : "";

  return (first + last).toUpperCase();
}

/** Color estable por nombre: misma entrada, mismo avatar en cada carga. */
function colorOf(name: string): string {
  let hash = 0;

  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }

  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]!;
}

function ActorCard({ actor }: { actor: ActorEntry }) {
  const films = actor.movies.map((movie) => movie.name).join(", ");
  const count =
    actor.movieCount === 1 ? "1 película" : `${actor.movieCount} películas`;

  return (
    <li
      title={films ? `En Nexus: ${films}` : undefined}
      className="flex flex-col items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-800/60 p-4 text-center"
    >
      <span
        aria-hidden="true"
        className={`flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold ${colorOf(actor.name)}`}
      >
        {initialsOf(actor.name)}
      </span>

      <div className="min-w-0 space-y-1">
        <p className="truncate text-sm font-medium text-white">{actor.name}</p>
        <p className="text-xs text-slate-400">{count}</p>
      </div>
    </li>
  );
}

export default ActorCard;
