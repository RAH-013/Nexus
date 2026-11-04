import { Prisma } from "../generated/prisma/client";
import { ItemType } from "../generated/prisma/enums";
import { prisma } from "../lib/prisma";
import { ensureItem } from "./item";

export const COMMENT_LIST_LIMIT = 50;
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

/** Resuelve el `Item` de un título por `externalId` + tipo (sin crearlo). */
export async function findTitleItem(
  type: TitleType,
  id: string,
): Promise<{ id: number } | null> {
  return prisma.item.findFirst({
    where: { externalId: id, type: itemTypeOf(type) },
    select: { id: true },
  });
}

/** Hasta 50 comentarios por título, más reciente primero (RF-8). */
export async function listComments(type: TitleType, id: string): Promise<CommentView[]> {
  const item = await findTitleItem(type, id);

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
 * ¿El usuario ya tiene un comentario con ese texto en el título?
 * `excludeId` deja fuera el comentario que se está reemplazando (PUT).
 */
export async function hasCommentWithText(
  itemId: number,
  userId: string,
  text: string,
  excludeId?: number,
): Promise<boolean> {
  const existing = await prisma.comment.findFirst({
    where: {
      itemId,
      userId,
      text,
      ...(excludeId === undefined ? {} : { id: { not: excludeId } }),
    },
    select: { id: true },
  });

  return existing !== null;
}

export type CreateCommentResult =
  | { ok: true; comment: CommentView }
  | { ok: false; reason: "duplicate" };

/**
 * Da de alta el título por `externalId` si hace falta (mismo patrón que
 * UserAction) y publica el comentario. El mismo usuario no puede repetir
 * texto en el mismo título: el `@@unique` de la BD es la última defensa
 * frente a dos peticiones simultáneas.
 */
export async function createComment(
  type: TitleType,
  id: string,
  userId: string,
  text: string,
): Promise<CreateCommentResult> {
  const item = await ensureItem(id, itemTypeOf(type));

  if (await hasCommentWithText(item.id, userId, text)) {
    return { ok: false, reason: "duplicate" };
  }

  try {
    const comment = await prisma.comment.create({
      data: { text, userId, itemId: item.id },
      select: {
        id: true,
        text: true,
        user: { select: { username: true, name: true } },
      },
    });

    return {
      ok: true,
      comment: {
        id: comment.id,
        text: comment.text,
        author: comment.user.username ?? comment.user.name,
      },
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, reason: "duplicate" };
    }

    throw error;
  }
}

/** Un comentario concreto de un título (público, como la lista). */
export async function getComment(
  type: TitleType,
  id: string,
  commentId: number,
): Promise<CommentView | null> {
  const item = await findTitleItem(type, id);

  if (!item) {
    return null;
  }

  const comment = await prisma.comment.findFirst({
    where: { id: commentId, itemId: item.id },
    select: {
      id: true,
      text: true,
      user: { select: { username: true, name: true } },
    },
  });

  if (!comment) {
    return null;
  }

  return {
    id: comment.id,
    text: comment.text,
    author: comment.user.username ?? comment.user.name,
  };
}
