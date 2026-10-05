import { useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type { MediaType } from "../api/cinemeta";
import CastSection from "../components/detail/CastSection";
import CommentsSection from "../components/detail/CommentsSection";
import DetailSkeleton from "../components/detail/DetailSkeleton";
import RatingCircle from "../components/detail/RatingCircle";
import TitleCard from "../components/detail/TitleCard";
import WatchButton from "../components/movies/WatchButton";
import SectionError from "../components/home/SectionError";
import { useTitleData } from "../hooks/useTitleData";
import NotFound from "./NotFound";

interface TitleViewProps {
  type: MediaType;
  id: string;
}

/**
 * Ficha de un título: URL pública `/title/:type/:id` con tres columnas en
 * escritorio (tarjeta/reparto · sinopsis/comentarios · ranking), estados
 * propios por sección y un único `<h1>` con el título de la obra (RF-1, RF-7,
 * RF-8, RNF-5, RNF-7).
 */
function TitleView({ type, id }: TitleViewProps) {
  const title = useTitleData(type, id);
  const navigate = useNavigate();
  const location = useLocation();

  // Al entrar o cambiar de título, arriba del todo (spec 002, D7).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [type, id]);

  /** URL directa sin historial previo → al inicio (caso 9). */
  const goBack = () => {
    if (location.key === "default") {
      navigate("/");
    } else {
      navigate(-1);
    }
  };

  if (title.status === "loading") {
    return <DetailSkeleton />;
  }

  if (title.status === "not-found") {
    return (
      <div
        role="alert"
        className="flex min-h-60 flex-col items-center justify-center gap-4 text-center"
      >
        <p className="text-lg text-slate-300">No encontramos ese título</p>
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

  if (title.status === "error") {
    return <SectionError onRetry={title.retry} />;
  }

  if (title.status === "rate-limit") {
    return <SectionError variant="limit" />;
  }

  const data = title.title;

  if (!data) {
    return <DetailSkeleton />;
  }

  const hasRating = Boolean(data.imdbRating);

  return (
    <div
      className={`grid gap-6 ${
        hasRating ? "lg:grid-cols-[1fr_1.4fr_1fr]" : "lg:grid-cols-[1fr_1.4fr]"
      }`}
    >
      <div className="min-w-0 space-y-6">
        <TitleCard title={data} />
        {/* RF-10: mismo control que las cards, solo en películas y con sesión
            (WatchButton se oculta solo); abrir la ficha no crea VIEW. */}
        {type === "movie" && <WatchButton id={id} />}
        <CastSection director={data.director} cast={data.cast} />
      </div>

      <div className="min-w-0 space-y-6">
        {data.description && (
          <section
            aria-label="Sinopsis"
            className="space-y-3 rounded-xl border border-slate-700 bg-slate-800/60 p-5"
          >
            <h2 className="text-lg font-semibold">Sinopsis</h2>
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">
              {data.description}
            </p>
          </section>
        )}

        <CommentsSection type={type} id={id} />
      </div>

      {hasRating && (
        <div className="min-w-0">
          <RatingCircle rating={data.imdbRating} />
        </div>
      )}
    </div>
  );
}

function TitleDetail() {
  const { type, id } = useParams();

  // Tipo o id inválido → la página de ruta no encontrada existente (D7).
  if ((type !== "movie" && type !== "series") || !id?.trim()) {
    return <NotFound />;
  }

  return <TitleView type={type} id={id} />;
}

export default TitleDetail;
