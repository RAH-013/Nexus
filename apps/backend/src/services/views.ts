import { ActionType, ItemType } from "../generated/prisma/enums";
import { prisma } from "../lib/prisma";

/**
 * Películas marcadas como vistas por un usuario (spec 003, RF-8): «he visto»
 * es que exista algún `UserAction` VIEW sobre el `Item` movie de ese usuario.
 * Pueden quedar varios `VIEW` históricos → ids sin repetir (caso 10).
 */
export async function listWatchedMovieIds(userId: string): Promise<string[]> {
  const actions = await prisma.userAction.findMany({
    where: { userId, type: ActionType.VIEW, item: { type: ItemType.MOVIE } },
    select: { item: { select: { externalId: true } } },
  });

  return [
    ...new Set(
      actions.flatMap((action) => (action.item ? [action.item.externalId] : [])),
    ),
  ];
}

/**
 * Marca la película como vista: da de alta el `Item` por `externalId` si hace
 * falta (mismo patrón que comentarios) y crea el `VIEW` solo si aún no existe,
 * para que un doble clic persista un solo cambio (caso 9).
 */
export async function markMovieViewed(userId: string, id: string): Promise<void> {
  const item = await prisma.item.upsert({
    where: { externalId: id },
    create: { externalId: id, type: ItemType.MOVIE },
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

/** Desmarcar borra todos los `VIEW` de ese usuario sobre ese ítem (caso 10). */
export async function unmarkMovieViewed(userId: string, id: string): Promise<void> {
  await prisma.userAction.deleteMany({
    where: { userId, type: ActionType.VIEW, item: { externalId: id } },
  });
}