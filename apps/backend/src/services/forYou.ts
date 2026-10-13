import { ActionType, ItemType } from "../generated/prisma/enums";
import { cacheDel, cacheGet, cacheSet } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { cinemetaService } from "./cinemeta";
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

/** Topo de títulos/ comentarios que viajan en el prompt (coste del modelo). */
const PROMPT_WATCHED_LIMIT = 60;
const PROMPT_COMMENTS_LIMIT = 20;

/** Cada lista de reacciones (favoritos, likes, dislikes) y enriquecimientos. */
const SIGNAL_LIST_LIMIT = 20;

/** Fichas de Cinemeta pedidas para enriquecer el perfil (nombre, año, género). */
const ENRICH_CONCURRENCY = 3;

/** Poda heurística que llega al modelo como candidatos (RF-8). */
const HEURISTIC_CANDIDATE_LIMIT = 50;

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
  source: "gemini" | "heuristic" | "empty";
  cachedAt: string;
}

interface RankedCandidate extends Candidate {
  score: number;
  reason: string;
}

let warnedNoKey = false;
let warnedFallback = false;

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

/** Peso de cada género según lo visto (+1), favoritos/likes (+3) y dislikes (−3). */
export function genreWeights(profile: UserProfile): Map<string, number> {
  const weights = new Map<string, number>();

  const add = (titles: PromptTitle[], delta: number): void => {
    for (const title of titles) {
      for (const genre of title.genres ?? []) {
        weights.set(genre, (weights.get(genre) ?? 0) + delta);
      }
    }
  };

  add(profile.watched, 1);
  add([...profile.favorites, ...profile.likes], 3);
  add(profile.dislikes, -3);

  return weights;
}

/**
 * Heurística local (poda y fallback, RF-7): afinidad de géneros (0-40) +
 * coincidencia de formato (0-20) + posición de tendencia (0-20).
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
      scoreCandidate(candidate, index, total, profile.format, weights),
    )
    .sort((a, b) => b.score - a.score);
}

function scoreCandidate(
  candidate: Candidate,
  position: number,
  total: number,
  format: PreferredFormat,
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
  const expected = format === "series" ? "series" : "movie";
  const formatScore = format === "mixto" || candidate.type === expected ? 20 : 5;

  // 3. Popularidad por posición en el catálogo de tendencia (decadencia lineal).
  const popularity = total > 0 ? (1 - position / total) * 20 : 10;

  return {
    ...candidate,
    score: Math.min(100, Math.round(affinity + formatScore + popularity)),
    reason: reasonTemplate(topGenre, format, candidate.type),
  };
}

/** Razón en español (plantilla) cuando el modelo no aporta la suya. */
function reasonTemplate(
  topGenre: string | undefined,
  format: PreferredFormat,
  type: "movie" | "series",
): string {
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
 * Candidatos = tendencia de movie + series, deduplicados y sin lo que el
 * usuario ya vio, marcó favorito o puntuó como no me gusta (RF-6).
 * Si un catálogo falla se usa el otro; si fallan ambos, se propaga el error.
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

/** Perfil del usuario: vistos (recientes primero), reacciones y comentarios. */
export async function buildProfile(
  userId: string,
): Promise<{ profile: UserProfile; excludedIds: Set<string> }> {
  const [watchedActions, reactions, comments, actorComments] =
    await Promise.all([
      prisma.userAction.findMany({
        where: { userId, type: ActionType.VIEW },
        select: { item: { select: { externalId: true, type: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.userAction.findMany({
        where: {
          userId,
          type: { in: [ActionType.FAVORITE, ActionType.LIKE, ActionType.DISLIKE] },
        },
        select: {
          type: true,
          item: { select: { externalId: true, type: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.comment.findMany({
        where: { userId },
        select: { id: true, text: true },
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

  const toPromptTitle = (item: {
    externalId: string;
    type: ItemType;
  }): PromptTitle => ({
    id: item.externalId,
    type: item.type === ItemType.MOVIE ? "movie" : "series",
  });

  const watchedAll = watchedActions.flatMap((action) =>
    action.item ? [toPromptTitle(action.item)] : [],
  );

  // Los 20 más recientes se enriquecen con la ficha (nombre, año, géneros);
  // el resto viaja solo con id (los errores no rompen el perfil).
  const watched = await enrichTitles(
    watchedAll.slice(0, PROMPT_WATCHED_LIMIT),
    SIGNAL_LIST_LIMIT,
  );

  const reactionTitles = (type: ActionType): PromptTitle[] =>
    reactions
      .filter((reaction) => reaction.type === type)
      .flatMap((reaction) =>
        reaction.item ? [toPromptTitle(reaction.item)] : [],
      );

  const [favorites, likes, dislikes] = await Promise.all([
    enrichTitles(reactionTitles(ActionType.FAVORITE), SIGNAL_LIST_LIMIT),
    enrichTitles(reactionTitles(ActionType.LIKE), SIGNAL_LIST_LIMIT),
    enrichTitles(reactionTitles(ActionType.DISLIKE), SIGNAL_LIST_LIMIT),
  ]);

  const promptComments: PromptComment[] = [
    ...comments.map((comment) => ({
      id: comment.id,
      fuente: "titulo" as const,
      text: comment.text,
    })),
    ...actorComments.map((comment) => ({
      id: comment.id,
      fuente: "actor" as const,
      text: comment.text,
      actorName: comment.actorName,
    })),
  ];

  // Excluir también los «no me gusta»: nadie quiere que se le recomiende
  // algo que ya rechazó (amplía RF-6 con sentido común).
  const excludedIds = new Set<string>([
    ...watchedAll.map((title) => title.id),
    ...favorites.map((title) => title.id),
    ...dislikes.map((title) => title.id),
  ]);

  return {
    profile: {
      format: deriveFormat(watchedAll),
      watched,
      favorites,
      likes,
      dislikes,
      comments: promptComments,
    },
    excludedIds,
  };
}

/** Rellena nombre/año/géneros de la cabeza con `getTitle` (caché de Cinemeta), en tandas; el resto queda con solo id. */
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
 * Recomendaciones «Para ti» del usuario (RF-8…RF-10, RNF-1):
 * caché Redis 24 h → perfil + candidatos → poda heurística → Gemini (si hay
 * clave y responde) o heurística; `refresh` fuerza el recálculo.
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

  const result = await computeForYou(userId);

  await cacheSet(
    key,
    result,
    result.items.length > 0 ? CACHE_TTL_SECONDS : EMPTY_CACHE_TTL_SECONDS,
  );

  return result;
}

async function computeForYou(userId: string): Promise<ForYouResult> {
  const { profile, excludedIds } = await buildProfile(userId);

  const signalCount =
    profile.watched.length +
    profile.favorites.length +
    profile.likes.length +
    profile.dislikes.length +
    profile.comments.length;

  // Casi sin actividad: ni modelo ni heurística (RF-13).
  if (signalCount < MIN_SIGNALS) {
    return { items: [], source: "empty", cachedAt: new Date().toISOString() };
  }

  const candidates = await getCandidates(excludedIds);
  const ranked = heuristicRank(profile, candidates);
  const fallback = ranked.slice(0, RECOMMENDATION_LIMIT);

  if (!geminiEnabled()) {
    if (!warnedNoKey) {
      warnedNoKey = true;
      console.warn(
        "GEMINI_API_KEY no configurada: «Para ti» usa el motor heurístico local",
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
        // Si el modelo no motivó el título, se usa la plantilla heurística.
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

    // Completar la tanda con la poda heurística.
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
