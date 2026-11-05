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

function toCommentView(comment: {
  id: number;
  text: string;
  user: { username: string | null; name: string };
}): CommentView {
  return {
    id: comment.id,
    text: comment.text,
    author: comment.user.username ?? comment.user.name,
  };
}

export async function findTitleItem(
  type: TitleType,
  id: string,
): Promise<{ id: number } | null> {
  return prisma.item.findFirst({
    where: { externalId: id, type: itemTypeOf(type) },
    select: { id: true },
  });
}

export async function listComments(
  type: TitleType,
  id: string,
): Promise<CommentView[]> {
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

  return comments.map(toCommentView);
}

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
      comment: toCommentView(comment),
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

  return comment ? toCommentView(comment) : null;
}

export type ReplaceCommentResult =
  | { ok: true; comment: CommentView }
  | { ok: false; reason: "not-found" | "forbidden" | "duplicate" };

export async function replaceComment(
  type: TitleType,
  id: string,
  commentId: number,
  userId: string,
  text: string,
): Promise<ReplaceCommentResult> {
  const item = await findTitleItem(type, id);

  if (!item) {
    return { ok: false, reason: "not-found" };
  }

  const existing = await prisma.comment.findFirst({
    where: { id: commentId, itemId: item.id },
    select: { id: true, userId: true },
  });

  if (!existing) {
    return { ok: false, reason: "not-found" };
  }

  if (existing.userId !== userId) {
    return { ok: false, reason: "forbidden" };
  }

  if (await hasCommentWithText(item.id, userId, text, commentId)) {
    return { ok: false, reason: "duplicate" };
  }

  try {
    const comment = await prisma.comment.update({
      where: { id: commentId },
      data: { text },
      select: {
        id: true,
        text: true,
        user: { select: { username: true, name: true } },
      },
    });

    return {
      ok: true,
      comment: toCommentView(comment),
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, reason: "duplicate" };
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return { ok: false, reason: "not-found" };
    }

    throw error;
  }
}

export type DeleteCommentResult = "ok" | "not-found" | "forbidden";

export async function deleteComment(
  type: TitleType,
  id: string,
  commentId: number,
  userId: string,
): Promise<DeleteCommentResult> {
  const item = await findTitleItem(type, id);

  if (!item) {
    return "not-found";
  }

  const existing = await prisma.comment.findFirst({
    where: { id: commentId, itemId: item.id },
    select: { id: true, userId: true },
  });

  if (!existing) {
    return "not-found";
  }

  if (existing.userId !== userId) {
    return "forbidden";
  }

  try {
    await prisma.comment.delete({
      where: { id: commentId },
    });

    return "ok";
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return "not-found";
    }

    throw error;
  }
}
