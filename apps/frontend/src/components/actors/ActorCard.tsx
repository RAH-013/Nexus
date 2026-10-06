import { useEffect, useRef, useState } from "react";
import type { ActorDetail, ActorEntry } from "../../api/cinemeta";
import { apiGetActor } from "../../api/cinemeta";
import { swal } from "../../utils/swal";

/**
 * Card de la cuadrícula de Actores: avatar con foto de TMDB (iniciales
 * de reserva mientras llega o si no hay), nombre y recuento de películas.
 * La ficha se pide a TMDB cuando la card entra en pantalla (una sola
 * vez) y se muestra completa al hacer clic o Intro.
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

/** La biografía es texto plano: se escapan los caracteres que Swal leería como HTML. */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      default:
        return "&quot;";
    }
  });
}

function ActorCard({ actor }: { actor: ActorEntry }) {
  const cardRef = useRef<HTMLLIElement>(null);
  const [detail, setDetail] = useState<ActorDetail | null>(null);

  const films = actor.movies.map((movie) => movie.name).join(", ");
  const count =
    actor.movieCount === 1 ? "1 película" : `${actor.movieCount} películas`;

  // Ficha bajo demanda: una sola petición por card, al entrar en pantalla.
  useEffect(() => {
    const card = cardRef.current;

    if (!card) {
      return;
    }

    let active = true;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.every((entry) => !entry.isIntersecting)) {
          return;
        }

        observer.disconnect();

        void apiGetActor(actor.name).then((result) => {
          if (active && result.success) {
            setDetail(result.data);
          }
        });
      },
      { rootMargin: "300px" },
    );

    observer.observe(card);

    return () => {
      active = false;
      observer.disconnect();
    };
  }, [actor.name]);

  /** Ficha del actor: foto, biografía y películas en las que aparece. */
  const openProfile = async () => {
    const person =
      detail ??
      (await apiGetActor(actor.name).then((result) =>
        result.success ? result.data : null,
      ));

    await swal.fire({
      title: actor.name,
      ...(person?.imageUrl
        ? { imageUrl: person.imageUrl, imageAlt: `Foto de ${actor.name}` }
        : {}),
      html: person?.biography
        ? `${escapeHtml(person.biography).replace(/\n+/g, "<br>")}`
        : "No hay biografía disponible.",
      footer: `<p class="text-sm">${count}</p>`,
    });
  };

  return (
    <li
      ref={cardRef}
      role="button"
      tabIndex={0}
      title={films ? `En Nexus: ${films}` : undefined}
      onClick={openProfile}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          void openProfile();
        }
      }}
      className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-800/60 p-4 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
    >
      {detail?.imageUrl ? (
        <img
          src={detail.imageUrl}
          alt={`Foto de ${actor.name}`}
          loading="lazy"
          className="h-16 w-16 rounded-full object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className={`flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold ${colorOf(actor.name)}`}
        >
          {initialsOf(actor.name)}
        </span>
      )}

      <div className="min-w-0 space-y-1">
        <p className="truncate text-sm font-medium text-white">{actor.name}</p>
        <p className="text-xs text-slate-400">{count}</p>
      </div>
    </li>
  );
}

export default ActorCard;
