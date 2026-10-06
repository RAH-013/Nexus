import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ActorDetail, ActorEntry } from "../../api/cinemeta";
import { apiGetActor } from "../../api/cinemeta";
import { colorOf, initialsOf } from "../../utils/actorAvatar";

/**
 * Card de la cuadrícula de Actores: avatar con foto de TMDB (iniciales
 * de reserva mientras llega o si no hay), nombre y recuento de
 * películas. La foto se pide a TMDB cuando la card entra en pantalla
 * (una sola vez) y la card enlaza al perfil del actor.
 */
function ActorCard({ actor }: { actor: ActorEntry }) {
  const cardRef = useRef<HTMLLIElement>(null);
  const [detail, setDetail] = useState<ActorDetail | null>(null);
  const navigate = useNavigate();

  const films = actor.movies.map((movie) => movie.name).join(", ");
  const count =
    actor.movieCount === 1 ? "1 película" : `${actor.movieCount} películas`;

  // Foto bajo demanda: una sola petición por card, al entrar en pantalla.
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

  const openProfile = () => {
    navigate(`/actor/${encodeURIComponent(actor.name)}`);
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
          openProfile();
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
