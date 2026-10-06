import type { Collection } from "../api/cinemeta";
import ContentRow from "../components/home/ContentRow";
import HeroCarousel from "../components/home/HeroCarousel";
import SectionError from "../components/home/SectionError";
import { useSectionData } from "../hooks/useSectionData";

/** Orden fijo de los 8 huecos de la pantalla (plan §4.1). */
const ROWS: { collection: Collection; title: string }[] = [
  { collection: "trending", title: "Tendencias" },
  { collection: "action", title: "Acción" },
  { collection: "drama", title: "Drama" },
  { collection: "adventure", title: "Aventura" },
  { collection: "thriller", title: "Suspenso" },
  { collection: "comedy", title: "Comedia" },
  { collection: "horror", title: "Terror" },
];

function HeroSkeleton() {
  const boxes = [
    { w: 160, h: 240 },
    { w: 200, h: 300 },
    { w: 240, h: 360 },
    { w: 200, h: 300 },
    { w: 160, h: 240 },
  ];

  return (
    <div
      className="relative flex h-[392px] items-center justify-center overflow-hidden"
      aria-hidden="true"
    >
      {boxes.map(({ w, h }, position) => (
        <div
          key={position}
          className={`flex shrink-0 flex-col items-center ${
            position > 0 ? "-ml-4" : ""
          }`}
          style={{ width: w }}
        >
          <div
            className="animate-pulse rounded-lg bg-slate-800 [@media(prefers-reduced-motion:reduce)]:animate-none"
            style={{ width: w, height: h }}
          />

          <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-slate-800 [@media(prefers-reduced-motion:reduce)]:animate-none" />
        </div>
      ))}
    </div>
  );
}

/**
 * Orquestador de la home: cada sección se pinta en cuanto llega y sus fallos
 * no afectan al resto (RF-12, RF-13, RNF-5). No hay estado global de error.
 */
function Home() {
  const featured = useSectionData("featured");

  return (
    <div className="space-y-10">
      {featured.status === "loading" && <HeroSkeleton />}
      {featured.status === "error" && <SectionError onRetry={featured.retry} />}
      {featured.status === "rate-limit" && <SectionError variant="limit" />}
      {featured.status === "ready" && <HeroCarousel items={featured.items} />}

      {ROWS.map((row) => (
        <ContentRow
          key={row.collection}
          title={row.title}
          collection={row.collection}
        />
      ))}
    </div>
  );
}

export default Home;
