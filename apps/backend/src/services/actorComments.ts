import { prisma } from "../lib/prisma";
import {
  COMMENT_LIST_LIMIT,
  type CommentView,
  validateCommentText,
  type CommentTextError,
  type ValidatedCommentText,
} from "./comments";

export { validateCommentText };
export type { CommentTextError, ValidatedCommentText };

/**
 * Comentarios de actores: iguales reglas de texto y límite de lista
 * que los de títulos (RF-8), pero por nombre de actor porque Cinemeta
 * no entrega id de persona.
 */
export async function listActorComments(
  actorName: string,
): Promise<CommentView[]> {
  const comments = await prisma.actorComment.findMany({
    where: { actorName },
    orderBy: { createdAt: "desc" },
    take: COMMENT_LIST_LIMIT,
    select: {
      id: true,
      text: true,
      user: { select: { username: true, name: true } },
    },
  });

  return comments.map(toView);
}

export async function createActorComment(
  actorName: string,
  userId: string,
  text: string,
): Promise<CommentView> {
  const comment = await prisma.actorComment.create({
    data: { text, userId, actorName },
    select: {
      id: true,
      text: true,
      user: { select: { username: true, name: true } },
    },
  });

  return toView(comment);
}

function toView(comment: {
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
