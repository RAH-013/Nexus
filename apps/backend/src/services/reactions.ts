import { ActionType, ItemType } from "../generated/prisma/enums";
import { prisma } from "../lib/prisma";
import { ensureItem } from "./item";

/** Reacciones sobre un título que entran en el perfil de recomendaciones (spec 004). */
export const REACTION_KINDS = ["favorite", "like", "dislike"] as const;

export type ReactionKind = (typeof REACTION_KINDS)[number];

const REACTION_TYPES: Record<ReactionKind, ActionType> = {
  favorite: ActionType.FAVORITE,
  like: ActionType.LIKE,
  dislike: ActionType.DISLIKE,
};

export interface ReactionLists {
  favorites: string[];
  likes: string[];
  dislikes: string[];
}

/** `externalId` de los títulos con FAVORITE, LIKE y DISLIKE del usuario en sesión. */
export async function listReactions(userId: string): Promise<ReactionLists> {
  const actions = await prisma.userAction.findMany({
    where: {
      userId,
      type: {
        in: [ActionType.FAVORITE, ActionType.LIKE, ActionType.DISLIKE],
      },
    },
    select: {
      type: true,
      item: { select: { externalId: true } },
    },
  });

  const lists: ReactionLists = { favorites: [], likes: [], dislikes: [] };

  for (const action of actions) {
    if (!action.item) {
      continue;
    }

    if (action.type === ActionType.FAVORITE) {
      lists.favorites.push(action.item.externalId);
    } else if (action.type === ActionType.LIKE) {
      lists.likes.push(action.item.externalId);
    } else {
      lists.dislikes.push(action.item.externalId);
    }
  }

  return {
    favorites: [...new Set(lists.favorites)],
    likes: [...new Set(lists.likes)],
    dislikes: [...new Set(lists.dislikes)],
  };
}

/**
 * Escribe (o borra) una reacción del usuario sobre un título:
 * Da de alta el `Item` si hace falta (patrón `views.ts`).
 * `like` y `dislike` se excluyen mutuamente; `favorite` es independiente.
 * Nunca toca `VIEW`.
 */
export async function setReaction(
  userId: string,
  kind: ReactionKind,
  type: ItemType,
  externalId: string,
  on: boolean,
): Promise<void> {
  const item = await ensureItem(externalId, type);

  const actionType = REACTION_TYPES[kind];

  if (!on) {
    await prisma.userAction.deleteMany({
      where: { userId, itemId: item.id, type: actionType },
    });

    return;
  }

  // Para re-crear «limpio» (y deduplicar) primero se borra la acción previa.
  // En like/dislike se borra además la contraria: exclusión mutua en una
  // sola transacción, para no dejar el par a medias.
  const cleanup = [
    prisma.userAction.deleteMany({
      where: { userId, itemId: item.id, type: actionType },
    }),
  ];

  if (kind !== "favorite") {
    const opposite = kind === "like" ? ActionType.DISLIKE : ActionType.LIKE;

    cleanup.unshift(
      prisma.userAction.deleteMany({
        where: { userId, itemId: item.id, type: opposite },
      }),
    );
  }

  await prisma.$transaction([
    ...cleanup,
    prisma.userAction.create({
      data: { userId, itemId: item.id, type: actionType },
    }),
  ]);
}
