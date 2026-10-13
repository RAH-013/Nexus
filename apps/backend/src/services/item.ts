import { Prisma } from "../generated/prisma/client";
import { ItemType } from "../generated/prisma/enums";
import { prisma } from "../lib/prisma";

/**
 * Devuelve el `Item` del `externalId`, dándolo de alta si no existe.
 *
 * Fix de carrera (spec 004, verificación E2E): `item.upsert` con el driver
 * adapter pg no es atómico (find→create), así que dos peticiones
 * concurrentes sobre el mismo título nuevo chocaban con el índice
 * `Item_externalId_key` y devolvían un 500 (p. ej. «Vista» + «Favorito» en
 * la misma ficha). Aquí el `create` captura ese conflicto (P2002) y relee
 * la fila que ganó la carrera.
 */
export async function ensureItem(
  externalId: string,
  type: ItemType,
): Promise<{ id: number }> {
  const existing = await prisma.item.findUnique({
    where: { externalId },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  try {
    return await prisma.item.create({
      data: { externalId, type },
      select: { id: true },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return prisma.item.findUniqueOrThrow({
        where: { externalId },
        select: { id: true },
      });
    }

    throw error;
  }
}
