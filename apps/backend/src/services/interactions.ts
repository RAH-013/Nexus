import { ActionType, ItemType } from "../generated/prisma/enums";
import { prisma } from "../lib/prisma";
import { cacheDel } from "../lib/redis";
import { ensureItem } from "./item";

/** Cooldown para registrar apertura de detalle y no saturar por recargas (2 horas). */
const DETAIL_VIEW_COOLDOWN_MS = 2 * 60 * 60 * 1000;

/** Invalida la clave de recomendaciones en Redis cuando cambia el perfil. */
export async function invalidateRecommendationsCache(userId: string): Promise<void> {
  const key = `nexus:for-you:${userId}`;
  await cacheDel(key);
}

/**
 * Registra la apertura de ficha de detalles de un título.
 * Evita registrar múltiples eventos por recargas o doble clic aplicando un cooldown de 2 horas.
 */
export async function recordDetailView(
  userId: string,
  type: ItemType,
  externalId: string,
): Promise<void> {
  const item = await ensureItem(externalId, type);
  const cutoff = new Date(Date.now() - DETAIL_VIEW_COOLDOWN_MS);

  const recent = await prisma.userAction.findFirst({
    where: {
      userId,
      itemId: item.id,
      type: ActionType.DETAIL_VIEW,
      createdAt: { gte: cutoff },
    },
    select: { id: true },
  });

  if (!recent) {
    await prisma.userAction.create({
      data: {
        userId,
        itemId: item.id,
        type: ActionType.DETAIL_VIEW,
      },
    });
  }
}

/**
 * Registra impresiones (apariciones en recomendaciones) por lotes,
 * sin duplicar en la misma jornada.
 */
export async function recordImpressionBatch(
  userId: string,
  items: { type: ItemType; externalId: string }[],
): Promise<void> {
  if (!items || items.length === 0) {
    return;
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  for (const entry of items.slice(0, 30)) {
    try {
      const item = await ensureItem(entry.externalId, entry.type);
      const existing = await prisma.userAction.findFirst({
        where: {
          userId,
          itemId: item.id,
          type: ActionType.IMPRESSION,
          createdAt: { gte: cutoff },
        },
        select: { id: true },
      });

      if (!existing) {
        await prisma.userAction.create({
          data: {
            userId,
            itemId: item.id,
            type: ActionType.IMPRESSION,
            value: 0,
          },
        });
      }
    } catch (error) {
      console.warn("No se pudo registrar impresión para item:", entry.externalId, error);
    }
  }
}

/**
 * Califica un título (1 a 5 estrellas).
 * Si rating <= 0 o null, elimina la calificación.
 */
export async function setUserRating(
  userId: string,
  type: ItemType,
  externalId: string,
  rating: number,
): Promise<void> {
  const item = await ensureItem(externalId, type);

  // Borrar calificación previa
  await prisma.userAction.deleteMany({
    where: {
      userId,
      itemId: item.id,
      type: ActionType.RATING,
    },
  });

  if (rating > 0) {
    const clampedRating = Math.min(5, Math.max(1, Math.round(rating)));

    await prisma.userAction.create({
      data: {
        userId,
        itemId: item.id,
        type: ActionType.RATING,
        value: clampedRating,
      },
    });
  }

  await invalidateRecommendationsCache(userId);
}

/**
 * Obtiene la calificación de un usuario para un título específico.
 */
export async function getUserRating(
  userId: string,
  externalId: string,
): Promise<number | null> {
  const action = await prisma.userAction.findFirst({
    where: {
      userId,
      type: ActionType.RATING,
      item: { externalId },
    },
    select: { value: true },
    orderBy: { createdAt: "desc" },
  });

  return action?.value ?? null;
}

/**
 * Devuelve un diccionario con todas las calificaciones del usuario { [externalId]: rating }.
 */
export async function listUserRatings(
  userId: string,
): Promise<Record<string, number>> {
  const actions = await prisma.userAction.findMany({
    where: {
      userId,
      type: ActionType.RATING,
      item: { isNot: null },
      value: { not: null },
    },
    select: {
      value: true,
      item: { select: { externalId: true } },
    },
  });

  const ratings: Record<string, number> = {};

  for (const action of actions) {
    if (action.item && action.value) {
      ratings[action.item.externalId] = action.value;
    }
  }

  return ratings;
}

/**
 * Marca o desmarca un título como «No me interesa».
 */
export async function setNotInterested(
  userId: string,
  type: ItemType,
  externalId: string,
  on: boolean,
): Promise<void> {
  const item = await ensureItem(externalId, type);

  await prisma.userAction.deleteMany({
    where: {
      userId,
      itemId: item.id,
      type: ActionType.NOT_INTERESTED,
    },
  });

  if (on) {
    await prisma.userAction.create({
      data: {
        userId,
        itemId: item.id,
        type: ActionType.NOT_INTERESTED,
      },
    });
  }

  await invalidateRecommendationsCache(userId);
}

/**
 * Lista los externalId marcados como «No me interesa» por el usuario.
 */
export async function listNotInterested(userId: string): Promise<string[]> {
  const actions = await prisma.userAction.findMany({
    where: {
      userId,
      type: ActionType.NOT_INTERESTED,
      item: { isNot: null },
    },
    select: {
      item: { select: { externalId: true } },
    },
  });

  return [
    ...new Set(
      actions.flatMap((action) => (action.item ? [action.item.externalId] : [])),
    ),
  ];
}
