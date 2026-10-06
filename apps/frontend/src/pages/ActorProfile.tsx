import { useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import PosterCard from "../components/home/PosterCard";
import CommentsSection from "../components/detail/CommentsSection";
import DetailSkeleton from "../components/detail/DetailSkeleton";
import SectionError from "../components/home/SectionError";
import { useActorData } from "../hooks/useActorData";
import { colorOf, initialsOf } from "../utils/actorAvatar";
import NotFound from "./NotFound";

/**
 * Perfil de un actor: URL pública `/actor/:name` con dos columnas
 * en escritorio (foto · biografía/comentarios). La foto y la
 * biografía vienen de TMDB; «Trabajos conocidos» solo pinta las
 * películas que Cinemeta entrega (no se promete información de
 * fuera de la fuente) y los comentarios son propios del actor.
 */
function ActorView({ name }: { name: string }) {
  const actor = useActorData(name);
  const navigate = useNavigate();
  const location = useLocation();

  // Al entrar o cambiar de actor, arriba del todo.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [name]);

  /** URL directa sin historial previo → al inicio. */
  const goBack = () => {
    if (location.key === "default") {
      navigate("/");
    } else {
      navigate(-1);
    }
  };

  if (actor.status === "loading") {
    return <DetailSkeleton />;
  }

  if (actor.status === "not-found") {
    return (
      <div
        role="alert"
        className="flex min-h-60 flex-col items-center justify-center gap-4 text-center"
      >
        <p className="text-lg text-slate-300">No encontramos ese actor</p>
        <button
          type="button"
          onClick={goBack}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
        >
          Volver
        </button>
      </div>
    );
  }

  if (actor.status === "error") {
    return <SectionError onRetry={actor.retry} />;
  }

  if (actor.status === "rate-limit") {
    return <SectionError variant="limit" />;
  }

  const data = actor.actor;

  if (!data) {
    return <DetailSkeleton />;
  }

  const count =
    data.movieCount === 1 ? "1 película" : `${data.movieCount} películas`;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <div className="min-w-0 space-y-6">
        <section
          aria-label="Actor"
          className="flex flex-col items-center gap-5 rounded-xl border border-slate-700 bg-slate-800/60 p-6 text-center sm:flex-row sm:items-start sm:text-left"
        >
          {data.imageUrl ? (
            <img
              src={data.imageUrl}
              alt={`Foto de ${data.name}`}
              className="h-48 w-36 shrink-0 rounded-xl object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className={`flex h-48 w-36 shrink-0 items-center justify-center rounded-xl text-4xl font-semibold ${colorOf(data.name)}`}
            >
              {initialsOf(data.name)}
            </span>
          )}

          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white">{data.name}</h1>
            <p className="mt-1 text-sm text-slate-400">{count}</p>
          </div>
        </section>

        {data.movies.length > 0 && (
          <section
            aria-label="Trabajos conocidos"
            className="space-y-4 rounded-xl border border-slate-700 bg-slate-800/60 p-5"
          >
            <h2 className="text-lg font-semibold">Trabajos conocidos</h2>

            {/* La agregación de actores solo usa catálogos de películas,
                así que todo el reparto enlaza a una ficha de movie. */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {data.movies.map((movie) => (
                <PosterCard
                  key={movie.id}
                  className="aspect-2/3 w-full"
                  item={{
                    id: movie.id,
                    type: "movie",
                    name: movie.name,
                    ...(movie.poster ? { poster: movie.poster } : {}),
                  }}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="min-w-0 space-y-6">
        {data.biography && (
          <section
            aria-label="Biografia"
            className="space-y-3 rounded-xl border border-slate-700 bg-slate-800/60 p-5"
          >
            <h2 className="text-lg font-semibold">Biografía</h2>
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">
              {data.biography}
            </p>
          </section>
        )}

        <CommentsSection actor={name} />
      </div>
    </div>
  );
}

function ActorProfile() {
  const { name } = useParams();

  // Nombre inválido → la página de ruta no encontrada existente.
  if (!name?.trim()) {
    return <NotFound />;
  }

  return <ActorView name={name} />;
}

export default ActorProfile;
