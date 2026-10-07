import { ActionType } from "../generated/prisma/enums";
import { prisma } from "../lib/prisma";
import { cinemetaService } from "./cinemeta";
import { profileImageUrl, tmdbService } from "./tmdb";

export type ActivityOrder = "asc" | "desc";

/** Título de la actividad (filas 1 y 2). */
export interface RecentTitle {
  externalId: string;
  type: "movie" | "series";
  name: string;
  poster?: string;
  /** ISO 8601; la ficha la formatea. */
  date: string;
}

/** Comentario del usuario en una película o serie (fila 2). */
export interface RecentComment extends RecentTitle {
  id: number;
  text: string;
}

export interface RecentActorComment {
    id: number;
    text: string;
    actorName: string;
    imageUrl?: string;
    date: string;
}

export interface ActivityPage<T> {
    items: T[];
    nextCursor: string | null;
}

export interface ActivityCursor {
    timeMs: number;
    id: number;
}

export function decodeCursor(cursor: string): ActivityCursor | null {
    const [time, id]= cursor.split(":");
    const timeMs = Number(time);
    const idNum = Number(id);

    return Number.isFinite(timeMs) && Number.isFinite(idNum)
    ? { timeMs, id: idNum }
    : null;
}

/**
 * filtro de Paginacion.
 */

function cursorWhere(
    order: ActivityOrder,
    cursor: ActivityCursor,
): Record<string, unknown> {
    const createdAt = new Date(cursor.timeMs);

    return order === "desc"
        ?{
            OR:[
                {createdAt: {lt: createdAt}},
                {createdAt: createdAt, id: { lt:cursor.id}},
            ],
        }:{
            OR: [
                {createdAt: {gt: createdAt}},
                {createdAt: createdAt, id: {gt:cursor.id}},
            ],
        }
}

function pageCut(
  rows: { id: number; createdAt: Date }[],
  limit: number,
): { hasMore: boolean; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const last = rows[Math.min(rows.length, limit) - 1];

  return {
    hasMore,
    nextCursor:
      hasMore && last ? `${last.createdAt.getTime()}:${last.id}` : null,
  };
}

/**
 * Fila 1: películas y series vistas
 */
export async function listRecentViews(
  userId: string,
  order: ActivityOrder,
  cursor: ActivityCursor | null,
  limit: number,
): Promise<ActivityPage<RecentTitle>> {
  const rows = await prisma.userAction.findMany({
    where: {
      userId,
      type: ActionType.VIEW,
      itemId: { not: null },
      ...(cursor ? cursorWhere(order, cursor) : {}),
    },
    orderBy: [{ createdAt: order }, { id: order }],
    take: limit + 1,
    include: { item: true },
  });

  const { hasMore, nextCursor } = pageCut(rows, limit);
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const items: RecentTitle[] = [];

  for (const row of pageRows) {
    const item = row.item;

    if (!item) {
      continue;
    }

    const title = await cinemetaService.getTitle(
      item.type === "MOVIE" ? "movie" : "series",
      item.externalId,
    );

    if (!title) {
      continue;
    }

    items.push({
      externalId: item.externalId,
      type: item.type === "MOVIE" ? "movie" : "series",
      name: title.name,
      ...(title.poster ? { poster: title.poster } : {}),
      date: row.createdAt.toISOString(),
    });
  }

  return { items, nextCursor };
}

/** Fila 2: comentarios del usuario en películas y series. */
export async function listRecentComments(
  userId: string,
  order: ActivityOrder,
  cursor: ActivityCursor | null,
  limit: number,
): Promise<ActivityPage<RecentComment>> {
  const rows = await prisma.comment.findMany({
    where: {
      userId,
      ...(cursor ? cursorWhere(order, cursor) : {}),
    },
    orderBy: [{ createdAt: order }, { id: order }],
    take: limit + 1,
    include: { item: true },
  });

  const { hasMore, nextCursor } = pageCut(rows, limit);
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const items: RecentComment[] = [];

  for (const row of pageRows) {
    const item = row.item;
    const title = await cinemetaService.getTitle(
      item.type === "MOVIE" ? "movie" : "series",
      item.externalId,
    );

    if (!title) {
      continue;
    }

    items.push({
      id: row.id,
      text: row.text,
      externalId: item.externalId,
      type: item.type === "MOVIE" ? "movie" : "series",
      name: title.name,
      ...(title.poster ? { poster: title.poster } : {}),
      date: row.createdAt.toISOString(),
    });
  }

  return { items, nextCursor };
}

/** Fila 3: comentarios del usuario en perfiles de actor. */
export async function listRecentActorComments(
  userId: string,
  order: ActivityOrder,
  cursor: ActivityCursor | null,
  limit: number,
): Promise<ActivityPage<RecentActorComment>> {
  const rows = await prisma.actorComment.findMany({
    where: {
      userId,
      ...(cursor ? cursorWhere(order, cursor) : {}),
    },
    orderBy: [{ createdAt: order }, { id: order }],
    take: limit + 1,
  });

  const { hasMore, nextCursor } = pageCut(rows, limit);
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const items: RecentActorComment[] = [];

  for (const row of pageRows) {
    const person = await tmdbService.findPerson(row.actorName);

    items.push({
      id: row.id,
      text: row.text,
      actorName: row.actorName,
      ...(person?.profilePath
        ? { imageUrl: profileImageUrl(person.profilePath) }
        : {}),
      date: row.createdAt.toISOString(),
    });
  }

  return { items, nextCursor };
}