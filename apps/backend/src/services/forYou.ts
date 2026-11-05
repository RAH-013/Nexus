import { ActionType, ItemType } from "../generated/prisma/enums";
import { cacheDel, cacheGet, cacheSet } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { cinemetaService } from "./cinemeta";
import { analyzeSentiment } from "./sentiment";
import {
  geminiEnabled,
  geminiRecommend,
  RECOMMENDATION_LIMIT,
  type Candidate,
  type PromptComment,
  type PromptTitle,
  type UserProfile,
} from "./gemini";

/** Señales mínimas para recomendar sin humo (RF-13: menos de 3 → vacío). */
const MIN_SIGNALS = 3;

/** Resultado útil 24 h (RNF-1); el vacío se reevalúa antes (10 min). */
const CACHE_TTL_SECONDS = 24 * 60 * 60;
const EMPTY_CACHE_TTL_SECONDS = 10 * 60;

/** Topes de títulos/comentarios/señales en el prompt y análisis. */
const PROMPT_WATCHED_LIMIT = 60;
const PROMPT_COMMENTS_LIMIT = 20;
const SIGNAL_LIST_LIMIT = 20;
const ENRICH_CONCURRENCY = 3;
const HEURISTIC_CANDIDATE_LIMIT = 50;

/** Vida media para decaimiento temporal (30 días). */
const HALF_LIFE_DAYS = 30;

export type PreferredFormat = "series" | "peliculas" | "mixto";

export interface ForYouItem {
  id: string;
  type: "movie" | "series";
  name: string;
  poster?: string;
  year?: string;
  score: number;
  reason: string;
}

export interface ForYouResult {
  items: ForYouItem[];
  source: "gemini" | "heuristic" | "empty" | "cold-start";
  cachedAt: string;
}

interface RankedCandidate extends Candidate {
  score: number;
  reason: string;
}

let warnedNoKey = false;
let warnedFallback = false;

/**
 * Calcula factor de decaimiento temporal exponencial.
 * Retorna 1.0 para eventos de hoy, ~0.5 a los 30 días, ~0.25 a los 60 días.
 */
export function timeDecayFactor(createdAt?: Date): number {
  if (!createdAt || !(createdAt instanceof Date) || Number.isNaN(createdAt.getTime())) {
    return 1.0;
  }

  const daysElapsed = Math.max(0, (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  return Math.pow(0.5, daysElapsed / HALF_LIFE_DAYS);
}

/** Formato preferido derivado de la proporción de vistos (sin migración). */
export function deriveFormat(
  watched: { type: "movie" | "series" }[],
): PreferredFormat {
  if (watched.length === 0) {
    return "mixto";
  }

  const movies = watched.filter((title) => title.type === "movie").length;
  const series = watched.length - movies;

  if (series > movies * 1.35) {
    return "series";
  }

  if (movies > series * 1.35) {
    return "peliculas";
  }

  return "mixto";
}

/**
 * Ponderación multicriterio de géneros considerando:
 * - Vistos (+1)
 * - Favoritos (+3)
 * - Likes (+3)
 * - Dislikes (-3)
 * - Calificaciones (1-2 estrellas: -3; 3 estrellas: +0.5; 4-5 estrellas: +3 o +4)
 * - Apertura de detalles (+0.5 con saturación logarítmica)
 * - Comentarios analizados por sentimiento (+2 si positivo, -2 si negativo)
 * - Factor de decaimiento temporal en función de la antigüedad de la interacción.
 */
export function genreWeights(profile: UserProfile): Map<string, number> {
  const weights = new Map<string, number>();

  const add = (titles: PromptTitle[], baseDelta: number, createdAt?: Date): void => {
    const factor = createdAt ? timeDecayFactor(createdAt) : 1.0;
    const delta = baseDelta * factor;

    for (const title of titles) {
      for (const genre of title.genres ?? []) {
        weights.set(genre, (weights.get(genre) ?? 0) + delta);
      }
    }
  };

  add(profile.watched, 1);
  add([...profile.favorites, ...profile.likes], 3);
  add(profile.dislikes, -3);

  // Considerar calificaciones explícitas
  if (profile.ratings) {
    for (const r of profile.ratings) {
      const delta = r.rating >= 5 ? 4 : r.rating >= 4 ? 3 : r.rating === 3 ? 0.5 : -3;
      add([{ id: r.id, type: "movie", genres: r.genres }], delta, r.createdAt);
    }
  }

  // Considerar apertura de detalles (interés débil con saturación logarítmica)
  if (profile.detailViews) {
    for (const d of profile.detailViews) {
      const delta = Math.min(2.0, Math.log2(1 + d.count) * 0.5);
      add([{ id: d.id, type: "movie", genres: d.genres }], delta, d.createdAt);
    }
  }

  // Considerar comentarios con análisis léxico de sentimientos
  if (profile.comments) {
    for (const c of profile.comments) {
      const sentiment = c.sentiment ?? analyzeSentiment(c.text);
      if (sentiment === "positivo") {
        if (c.genres) add([{ id: String(c.id), type: "movie", genres: c.genres }], 2);
      } else if (sentiment === "negativo") {
        if (c.genres) add([{ id: String(c.id), type: "movie", genres: c.genres }], -2);
      }
    }
  }

  return weights;
}

/**
 * Heurística local (poda y fallback): afinidad de géneros (0-40) +
 * coincidencia de formato (0-20) + directores/actores (0-20) + tendencia (0-20).
 * Ordena de mayor a menor score y genera una razón en español.
 */
export function heuristicRank(
  profile: UserProfile,
  candidates: Candidate[],
): RankedCandidate[] {
  const weights = genreWeights(profile);
  const total = candidates.length;

  return candidates
    .map((candidate, index) =>
      scoreCandidate(candidate, index, total, profile, weights),
    )
    .sort((a, b) => b.score - a.score);
}

function scoreCandidate(
  candidate: Candidate,
  position: number,
  total: number,
  profile: UserProfile,
  weights: Map<string, number>,
): RankedCandidate {
  // 1. Afinidad de géneros: media del peso de sus géneros, de [-3, +4] a [0, 40].
  const genres = candidate.genres ?? [];
  let affinity = 20;
  let topGenre: string | undefined;

  if (genres.length > 0) {
    const scores = genres.map((genre) => weights.get(genre) ?? 0);
    const average = scores.reduce((sum, value) => sum + value, 0) / scores.length;
    const clamped = Math.min(4, Math.max(-3, average));

    affinity = ((clamped + 3) / 7) * 40;

    const bestIndex = scores.indexOf(Math.max(...scores));
    if (scores[bestIndex] > 0) {
      topGenre = genres[bestIndex];
    }
  }

  // 2. Formato preferido: «mixto» acepta ambos; si no, su tipo vale 20 y el otro 5.
  const expected = profile.format === "series" ? "series" : "movie";
  const formatScore = profile.format === "mixto" || candidate.type === expected ? 20 : 5;

  // 3. Coincidencia con actores o directores favoritos (0-20)
  let creatorAffinity = 0;
  let matchedCreator: string | undefined;

  if (candidate.director && profile.preferredDirectors?.includes(candidate.director)) {
    creatorAffinity = 15;
    matchedCreator = candidate.director;
  } else if (candidate.cast && profile.preferredActors) {
    const matched = candidate.cast.find((actor) => profile.preferredActors?.includes(actor));
    if (matched) {
      creatorAffinity = 10;
      matchedCreator = matched;
    }
  }

  // 4. Popularidad por posición en el catálogo de tendencia (decadencia lineal 0-20).
  const popularity = total > 0 ? (1 - position / total) * 20 : 10;

  const totalScore = Math.min(
    100,
    Math.round(affinity + formatScore + creatorAffinity + (popularity * 0.7)),
  );

  return {
    ...candidate,
    score: totalScore,
    reason: reasonTemplate(topGenre, profile.format, candidate.type, matchedCreator),
  };
}

/** Razón en español cuando el modelo no aporta la suya. */
function reasonTemplate(
  topGenre: string | undefined,
  format: PreferredFormat,
  type: "movie" | "series",
  matchedCreator?: string,
): string {
  if (matchedCreator) {
    return `Por tu interés en producciones con ${matchedCreator}`;
  }

  if (topGenre) {
    return `Por tu afición a ${topGenre}, encaja con lo que sueles ver`;
  }

  if (format !== "mixto") {
    return type === "series"
      ? "Serie bien valorada, en tu formato preferido"
      : "Película bien valorada, en tu formato preferido";
  }

  return "En tendencia en los catálogos de Nexus";
}

/**
 * Candidatos = tendencia de movie + series, deduplicados y excluyendo:
 * - Vistos
 * - Favoritos
 * - No me gusta (DISLIKE)
 * - Descartados (NOT_INTERESTED)
 */
export async function getCandidates(
  excludedIds: Set<string>,
): Promise<Candidate[]> {
  const [movies, series] = await Promise.allSettled([
    cinemetaService.getMovieList("trending"),
    cinemetaService.getSeriesList("trending"),
  ]);

  if (movies.status === "rejected" && series.status === "rejected") {
    throw movies.reason;
  }

  const candidates: Candidate[] = [];
  const seen = new Set<string>();

  for (const result of [movies, series]) {
    if (result.status === "rejected") {
      console.warn("Catálogo de tendencia no disponible:", result.reason);
      continue;
    }

    for (const item of result.value) {
      if (excludedIds.has(item.id) || seen.has(item.id)) {
        continue;
      }

      seen.add(item.id);
      candidates.push({
        id: item.id,
        type: item.type,
        name: item.name,
        ...(item.poster ? { poster: item.poster } : {}),
        ...(item.year ? { year: item.year } : {}),
        ...(item.genres ? { genres: item.genres } : {}),
      });
    }
  }

  return candidates;
}

/** Perfil del usuario: vistos, reacciones, calificaciones, comentarios y descartes. */
export async function buildProfile(
  userId: string,
): Promise<{ profile: UserProfile; excludedIds: Set<string> }> {
  const [
    watchedActions,
    reactions,
    ratingsActions,
    detailActions,
    notInterestedActions,
    comments,
    actorComments,
  ] = await Promise.all([
    prisma.userAction.findMany({
      where: { userId, type: ActionType.VIEW },
      select: { createdAt: true, item: { select: { externalId: true, type: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.userAction.findMany({
      where: {
        userId,
        type: { in: [ActionType.FAVORITE, ActionType.LIKE, ActionType.DISLIKE] },
      },
      select: {
        type: true,
        createdAt: true,
        item: { select: { externalId: true, type: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.userAction.findMany({
      where: { userId, type: ActionType.RATING, value: { not: null } },
      select: { value: true, createdAt: true, item: { select: { externalId: true, type: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.userAction.findMany({
      where: { userId, type: ActionType.DETAIL_VIEW },
      select: { createdAt: true, item: { select: { externalId: true, type: true } } },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.userAction.findMany({
      where: { userId, type: ActionType.NOT_INTERESTED },
      select: { item: { select: { externalId: true } } },
    }),
    prisma.comment.findMany({
      where: { userId },
      select: { id: true, text: true, item: { select: { externalId: true, type: true } } },
      orderBy: { createdAt: "desc" },
      take: PROMPT_COMMENTS_LIMIT,
    }),
    prisma.actorComment.findMany({
      where: { userId },
      select: { id: true, text: true, actorName: true },
      orderBy: { createdAt: "desc" },
      take: PROMPT_COMMENTS_LIMIT,
    }),
  ]);

  const toPromptTitle = (
    item: { externalId: string; type: ItemType },
    createdAt?: Date,
  ): PromptTitle => ({
    id: item.externalId,
    type: item.type === ItemType.MOVIE ? "movie" : "series",
    createdAt,
  });

  const watchedAll = watchedActions.flatMap((action) =>
    action.item ? [toPromptTitle(action.item, action.createdAt)] : [],
  );

  const watched = await enrichTitles(
    watchedAll.slice(0, PROMPT_WATCHED_LIMIT),
    SIGNAL_LIST_LIMIT,
  );

  const reactionTitles = (type: ActionType): PromptTitle[] =>
    reactions
      .filter((reaction) => reaction.type === type)
      .flatMap((reaction) =>
        reaction.item ? [toPromptTitle(reaction.item, reaction.createdAt)] : [],
      );

  const [favorites, likes, dislikes] = await Promise.all([
    enrichTitles(reactionTitles(ActionType.FAVORITE), SIGNAL_LIST_LIMIT),
    enrichTitles(reactionTitles(ActionType.LIKE), SIGNAL_LIST_LIMIT),
    enrichTitles(reactionTitles(ActionType.DISLIKE), SIGNAL_LIST_LIMIT),
  ]);

  // Preparar ratings enriquecidos
  const ratings: { id: string; rating: number; genres?: string[]; createdAt?: Date }[] = [];
  for (const r of ratingsActions) {
    if (r.item && r.value) {
      ratings.push({
        id: r.item.externalId,
        rating: r.value,
        createdAt: r.createdAt,
      });
    }
  }

  // Agrupar visualizaciones de detalles por ítem
  const detailMap = new Map<string, { count: number; createdAt: Date }>();
  for (const d of detailActions) {
    if (d.item) {
      const prev = detailMap.get(d.item.externalId);
      detailMap.set(d.item.externalId, {
        count: (prev?.count ?? 0) + 1,
        createdAt: prev && prev.createdAt > d.createdAt ? prev.createdAt : d.createdAt,
      });
    }
  }

  const detailViews = Array.from(detailMap.entries()).map(([id, val]) => ({
    id,
    count: val.count,
    createdAt: val.createdAt,
  }));

  const promptComments: PromptComment[] = [
    ...comments.map((comment) => ({
      id: comment.id,
      fuente: "titulo" as const,
      text: comment.text,
      sentiment: analyzeSentiment(comment.text),
    })),
    ...actorComments.map((comment) => ({
      id: comment.id,
      fuente: "actor" as const,
      text: comment.text,
      actorName: comment.actorName,
      sentiment: analyzeSentiment(comment.text),
    })),
  ];

  const notInterestedIds = notInterestedActions.flatMap((a) =>
    a.item ? [a.item.externalId] : [],
  );

  // Exclusiones estrictas: Vistos, Favoritos, Dislikes y No me interesa
  const excludedIds = new Set<string>([
    ...watchedAll.map((title) => title.id),
    ...favorites.map((title) => title.id),
    ...dislikes.map((title) => title.id),
    ...notInterestedIds,
  ]);

  return {
    profile: {
      format: deriveFormat(watchedAll),
      watched,
      favorites,
      likes,
      dislikes,
      comments: promptComments,
      ratings,
      detailViews,
      notInterested: notInterestedIds,
    },
    excludedIds,
  };
}

/** Rellena nombre/año/géneros de la cabeza con `getTitle`. */
async function enrichTitles(
  titles: PromptTitle[],
  enrichCount: number,
): Promise<PromptTitle[]> {
  const head = titles.slice(0, enrichCount);
  const tail = titles.slice(enrichCount);
  const enriched: PromptTitle[] = [];

  for (let index = 0; index < head.length; index += ENRICH_CONCURRENCY) {
    const chunk = head.slice(index, index + ENRICH_CONCURRENCY);

    const results = await Promise.all(
      chunk.map(async (title): Promise<PromptTitle> => {
        try {
          const detail = await cinemetaService.getTitle(title.type, title.id);

          if (!detail) {
            return title;
          }

          return {
            ...title,
            name: detail.name,
            ...(detail.year ? { year: detail.year } : {}),
            ...(detail.genres ? { genres: detail.genres } : {}),
          };
        } catch {
          return title;
        }
      }),
    );

    enriched.push(...results);
  }

  return [...enriched, ...tail];
}

/**
 * Recomendaciones «Para ti» del usuario:
 * Caché Redis 24 h → perfil + candidatos → poda heurística → Gemini o heurística.
 */
export async function getForYou(
  userId: string,
  refresh = false,
): Promise<ForYouResult> {
  const key = `nexus:for-you:${userId}`;

  if (refresh) {
    await cacheDel(key);
  } else {
    const cached = await cacheGet<ForYouResult>(key);

    if (cached) {
      return cached;
    }
  }

  const result = await computeForYou(userId, refresh);

  await cacheSet(
    key,
    result,
    result.items.length > 0 ? CACHE_TTL_SECONDS : EMPTY_CACHE_TTL_SECONDS,
  );

  return result;
}

/**
 * Selecciona una tanda variada y fresca a partir de los candidatos rankeados:
 * - Asegura los mejores títulos absolutos (mayor afinidad).
 * - En peticiones de refresco introduce rotación y exploración en el top de candidatos,
 *   evitando que el usuario vea exactamente los mismos títulos hasta descartarlos.
 */
function selectDiverseRecommendations(
  ranked: RankedCandidate[],
  limit: number,
  refresh: boolean,
): RankedCandidate[] {
  if (ranked.length <= limit) {
    return ranked;
  }

  if (!refresh) {
    return ranked.slice(0, limit);
  }

  const topCount = Math.min(2, Math.floor(limit / 4));
  const guaranteed = ranked.slice(0, topCount);
  const pool = ranked.slice(topCount, Math.min(35, ranked.length));

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const selected = [...guaranteed, ...shuffled.slice(0, limit - guaranteed.length)];

  return selected.sort((a, b) => b.score - a.score);
}

async function computeForYou(userId: string, refresh = false): Promise<ForYouResult> {
  const { profile, excludedIds } = await buildProfile(userId);

  const signalCount =
    profile.watched.length +
    profile.favorites.length +
    profile.likes.length +
    profile.dislikes.length +
    profile.comments.length +
    (profile.ratings?.length ?? 0) +
    (profile.detailViews?.length ?? 0);

  // Menos de 3 señales: retornar empty para cumplir spec
  if (signalCount < MIN_SIGNALS) {
    return { items: [], source: "empty", cachedAt: new Date().toISOString() };
  }

  const candidates = await getCandidates(excludedIds);
  const ranked = heuristicRank(profile, candidates);
  const fallback = selectDiverseRecommendations(ranked, RECOMMENDATION_LIMIT, refresh);

  if (!geminiEnabled()) {
    if (!warnedNoKey) {
      warnedNoKey = true;
      console.warn(
        "GEMINI_API_KEY no configurada: «Para ti» usa el motor heurístico local avanzado",
      );
    }

    return {
      items: fallback.map(toItem),
      source: "heuristic",
      cachedAt: new Date().toISOString(),
    };
  }

  try {
    const { recommendations } = await geminiRecommend(
      profile,
      ranked.slice(0, HEURISTIC_CANDIDATE_LIMIT),
    );

    if (recommendations.length === 0) {
      throw new Error("Gemini no devolvió recomendaciones válidas");
    }

    const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
    const heuristicById = new Map(ranked.map((entry) => [entry.id, entry]));
    const items: ForYouItem[] = [];
    const used = new Set<string>();

    for (const recommendation of recommendations) {
      const candidate = byId.get(recommendation.id);

      if (!candidate || used.has(recommendation.id)) {
        continue;
      }

      used.add(recommendation.id);
      items.push({
        ...candidate,
        score: recommendation.score,
        reason:
          recommendation.reason ||
          heuristicById.get(recommendation.id)?.reason ||
          "Recomendado para ti",
      });

      if (items.length === RECOMMENDATION_LIMIT) {
        break;
      }
    }

    if (items.length === 0) {
      throw new Error("Gemini no devolvió ids candidatos");
    }

    // Completar la tanda con la poda heurística
    for (const entry of fallback) {
      if (items.length >= RECOMMENDATION_LIMIT) {
        break;
      }

      if (!used.has(entry.id)) {
        used.add(entry.id);
        items.push(toItem(entry));
      }
    }

    return {
      items,
      source: "gemini",
      cachedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (!warnedFallback) {
      warnedFallback = true;
      console.warn(
        "Gemini no disponible: «Para ti» usa el motor heurístico local",
        error instanceof Error ? error.message : error,
      );
    }

    return {
      items: fallback.map(toItem),
      source: "heuristic",
      cachedAt: new Date().toISOString(),
    };
  }
}

function toItem(entry: RankedCandidate): ForYouItem {
  const { id, type, name, poster, year, score, reason } = entry;

  return {
    id,
    type,
    name,
    ...(poster ? { poster } : {}),
    ...(year ? { year } : {}),
    score,
    reason,
  };
}
