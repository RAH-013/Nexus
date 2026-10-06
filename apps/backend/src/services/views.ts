import { ActionType, ItemType } from "../generated/prisma/enums";
import { prisma } from "../lib/prisma";

/**
 * Retorna todos los `externalId` marcados como vistos por el usuario.
 * Si se especifica `type`, filtra por el tipo de ítem (MOVIE o SERIES).
 * Si no se especifica, retorna todos los títulos vistos.
 */
export async function listWatchedIds(
  userId: string,
  type?: ItemType,
): Promise<string[]> {
  const actions = await prisma.userAction.findMany({
    where: {
      userId,
      type: ActionType.VIEW,
      ...(type ? { item: { type } } : {}),
    },
    select: { item: { select: { externalId: true } } },
  });

  return [
    ...new Set(
      actions.flatMap((action) => (action.item ? [action.item.externalId] : [])),
    ),
  ];
}

/** Compatibilidad con las firmas anteriores */
export async function listWatchedMovieIds(userId: string): Promise<string[]> {
  return listWatchedIds(userId, ItemType.MOVIE);
}

export async function listWatchedSeriesIds(userId: string): Promise<string[]> {
  return listWatchedIds(userId, ItemType.SERIES);
}

/**
 * Marca un ítem (película o serie) como visto:
 * Da de alta el `Item` si hace falta y crea el `VIEW` solo si aún no existe.
 */
export async function markItemViewed(
  userId: string,
  id: string,
  type: ItemType,
): Promise<void> {
  const item = await prisma.item.upsert({
    // Los ids de IMDb son globales (un tt… pertenece a un solo título/tipo),
    // así basta el único de `externalId` para identificar el par (tipo, id).
    where: { externalId: id },
    create: { externalId: id, type },
    update: {},
  });

  const existing = await prisma.userAction.count({
    where: { userId, itemId: item.id, type: ActionType.VIEW },
  });

  if (existing === 0) {
    await prisma.userAction.create({
      data: { userId, itemId: item.id, type: ActionType.VIEW },
    });
  }
}

/** Desmarcar borra todos los `VIEW` de ese usuario sobre ese ítem por tipo. */
export async function unmarkItemViewed(
  userId: string,
  id: string,
  type: ItemType,
): Promise<void> {
  await prisma.userAction.deleteMany({
    where: {
      userId,
      type: ActionType.VIEW,
      item: { externalId: id, type },
    },
  });
}

/* ================= Funciones Helper para Películas ================= */

export async function markMovieViewed(userId: string, id: string): Promise<void> {
  return markItemViewed(userId, id, ItemType.MOVIE);
}

export async function unmarkMovieViewed(userId: string, id: string): Promise<void> {
  return unmarkItemViewed(userId, id, ItemType.MOVIE);
}

/* ================= Funciones Helper para Series ================= */

export async function markSeriesViewed(userId: string, id: string): Promise<void> {
  return markItemViewed(userId, id, ItemType.SERIES);
}

export async function unmarkSeriesViewed(userId: string, id: string): Promise<void> {
  return unmarkItemViewed(userId, id, ItemType.SERIES);
}