import { useRef, useState } from "react";

import { ClapIcon, PlayIcon, type PlayIconHandle } from "lucide-animated";

import type { TitleDetail } from "../../api/cinemeta";

import { translateGenre } from "../../utils/genres";

interface TitleCardProps {
  title: TitleDetail;
}

function formatRuntime(runtime?: string): string | undefined {
  const match = runtime?.match(/^\s*(\d+)\s*min\s*$/);

  if (!match) {
    return undefined;
  }

  const minutes = Number(match[1]);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours === 0) {
    return `${minutes}min`;
  }

  if (rest === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${rest}min`;
}

function TitleCard({ title }: TitleCardProps) {
  const [broken, setBroken] = useState(false);
  const playRef = useRef<PlayIconHandle>(null);

  const withImage = Boolean(title.poster) && !broken;

  const genres = title.genres?.length
    ? title.genres.map(translateGenre).join(", ")
    : undefined;

  const runtime = formatRuntime(title.runtime);

  return (
    <div className="space-y-4">
      <h1
        className="truncate text-2xl font-bold text-white sm:text-3xl"
        title={title.name}
      >
        {title.name}
        {title.year && (
          <span className="ml-2 text-lg font-medium text-slate-400">
            {title.year}
          </span>
        )}
      </h1>

      <div className="relative overflow-hidden rounded-lg bg-slate-800">
        {withImage ? (
          <img
            src={title.poster}
            alt={title.name}
            onError={() => setBroken(true)}
            className="aspect-2/3 w-full object-cover"
          />
        ) : (
          <div
            role="img"
            aria-label={`Sin póster de ${title.name}`}
            className="flex aspect-2/3 w-full items-center justify-center bg-slate-700 text-slate-500"
          >
            <ClapIcon size={40} animateOnHover={false} aria-hidden="true" />
          </div>
        )}

        {title.trailerSource && (
          <a
            href={`https://www.youtube.com/watch?v=${title.trailerSource}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Ver tráiler de ${title.name}`}
            onMouseEnter={() => playRef.current?.startAnimation()}
            onMouseLeave={() => playRef.current?.stopAnimation()}
            className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-teal-500 text-slate-900 shadow-lg transition-colors hover:bg-teal-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
          >
            <PlayIcon
              ref={playRef}
              size={20}
              animateOnHover={false}
              aria-hidden="true"
            />
          </a>
        )}
      </div>

      {(genres || runtime) && (
        <p className="text-sm text-slate-300">
          {genres}
          {genres && runtime && " · "}
          {runtime}
        </p>
      )}
    </div>
  );
}

export default TitleCard;
