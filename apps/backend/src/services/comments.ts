import { ItemType } from "../generated/prisma/enums";
import { prisma } from "../lib/prisma";

const COMMENT_LIST_LIMIT = 50;
const COMMENT_MAX_LENGTH = 500;

export type CommentTextError = "invalid" | "empty" | "too-long";

export type ValidatedCommentText =
  | { ok: true; text: string }
  | { ok: false; reason: CommentTextError };

/** Valida el texto en servidor (mismas reglas que en cliente, RF-8). */
export function validateCommentText(value: unknown): ValidatedCommentText {
  if (typeof value !== "string") {
    return { ok: false, reason: "invalid" };
  }

  const text = value.trim();

  if (!text) {
    return { ok: false, reason: "empty" };
  }

  if (text.length > COMMENT_MAX_LENGTH) {
    return { ok: false, reason: "too-long" };
  }

  return { ok: true, text };
}

export interface CommentView {
  id: number;
  text: string;
  author: string;
}

type TitleType = "movie" | "series";

function itemTypeOf(type: TitleType): ItemType {
  return type === "movie" ? ItemType.MOVIE : ItemType.SERIES;
}

/** Hasta 50 comentarios por título, más reciente primero (RF-8). */
export async function listComments(type: TitleType, id: string): Promise<CommentView[]> {
  const item = await prisma.item.findFirst({
    where: { externalId: id, type: itemTypeOf(type) },
    select: { id: true },
  });

  if (!item) {
    return [];
  }

  const comments = await prisma.comment.findMany({
    where: { itemId: item.id },
    orderBy: { createdAt: "desc" },
    take: COMMENT_LIST_LIMIT,
    select: {
      id: true,
      text: true,
      user: { select: { username: true, name: true } },
    },
  });

  return comments.map((comment) => ({
    id: comment.id,
    text: comment.text,
    author: comment.user.username ?? comment.user.name,
  }));
}

/**
 * Da de alta el título por `externalId` si hace falta (mismo patrón que
 * UserAction) y publica el comentario.
 */
export async function createComment(
  type: TitleType,
  id: string,
  userId: string,
  text: string,
): Promise<CommentView> {
  const item = await prisma.item.upsert({
    where: { externalId: id },
    create: { externalId: id, type: itemTypeOf(type) },
    update: {},
  });

  const comment = await prisma.comment.create({
    data: { text, userId, itemId: item.id },
    select: {
      id: true,
      text: true,
      user: { select: { username: true, name: true } },
    },
  });

  return {
    id: comment.id,
    text: comment.text,
    author: comment.user.username ?? comment.user.name,
  };
}
