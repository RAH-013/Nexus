import assert from "node:assert/strict";
import { test } from "node:test";

import { Prisma } from "../generated/prisma/client";
import { ActionType, ItemType } from "../generated/prisma/enums";
import { prisma } from "../lib/prisma";
import { listReactions, setReaction } from "./reactions";

/** Sustituye un método del singleton de Prisma y devuelve su restaurador. */
function stub(object: object, key: string, value: unknown): () => void {
  const record = object as Record<string, unknown>;
  const original = record[key];

  record[key] = value;

  return () => {
    record[key] = original;
  };
}

/** Errores P2002 reales: `ensureItem` filtra con `instanceof`. */
function uniqueViolation(): Error {
  return new Prisma.PrismaClientKnownRequestError(
    "Unique constraint failed on the constraint: `Item_externalId_key`",
    { code: "P2002", clientVersion: "7.10.0" },
  );
}

/** Stub mínimo de `ensureItem` (item) + registro de `userAction`. */
function stubPrisma(
  t: { after: (fn: () => void) => void },
  item: { id: number },
  findManyResult: unknown[] = [],
  options: { race?: boolean } = {},
): { calls: string[]; transactions: unknown[][]; creates: unknown[] } {
  const calls: string[] = [];
  const transactions: unknown[][] = [];
  const creates: unknown[] = [];

  // ensureItem: la fila no existe → create (con la carrera opcional P2002).
  t.after(stub(prisma.item, "findUnique", async () => null));

  t.after(
    stub(
      prisma.item,
      "create",
      async (args: { data: { externalId: string; type: ItemType } }) => {
        creates.push(args);

        if (options.race) {
          throw uniqueViolation();
        }

        return item;
      },
    ),
  );

  // ensureItem: tras el P2002 relee la fila que ganó la carrera.
  t.after(stub(prisma.item, "findUniqueOrThrow", async () => item));

  t.after(
    stub(prisma.userAction, "findMany", async () => findManyResult),
  );

  t.after(
    stub(
      prisma.userAction,
      "deleteMany",
      async (args: { where: { type: ActionType } }) => {
        calls.push(`delete:${args.where.type}`);
        return { kind: "delete", type: args.where.type };
      },
    ),
  );

  t.after(
    stub(
      prisma.userAction,
      "create",
      async (args: { data: { type: ActionType } }) => {
        calls.push(`create:${args.data.type}`);
        return { kind: "create", type: args.data.type };
      },
    ),
  );

  t.after(
    stub(prisma, "$transaction", async (operations: unknown[]) => {
      // Las operaciones son promesas: se resuelven para registrar lo que
      // la transacción ejecutará, en orden.
      transactions.push(await Promise.all(operations));
      return operations;
    }),
  );

  return { calls, transactions, creates };
}

test("like: on borra el no me gusta previo y crea el like en una transacción", async (t) => {
  const { calls, transactions, creates } = stubPrisma(t, { id: 7 });

  await setReaction("user-1", "like", ItemType.MOVIE, "tt123", true);

  // El orden que importa es el de ejecución dentro de la transacción:
  // primero la contraria, luego la propia y al final la creación.
  assert.deepEqual(transactions, [
    [
      { kind: "delete", type: ActionType.DISLIKE },
      { kind: "delete", type: ActionType.LIKE },
      { kind: "create", type: ActionType.LIKE },
    ],
  ]);

  // También se invocaron las tres operaciones (el orden de invocación da igual).
  assert.equal(calls.length, 3);
  assert.ok(calls.includes(`create:${ActionType.LIKE}`));

  // El Item se da de alta con `ensureItem` (create por externalId).
  assert.deepEqual(creates, [
    {
      data: { externalId: "tt123", type: ItemType.MOVIE },
      select: { id: true },
    },
  ]);
});

test("la carrera del Item (P2002) no rompe la reacción: relee y completa", async (t) => {
  const { calls, creates } = stubPrisma(t, { id: 7 }, [], { race: true });

  // Otro request creó el Item primero: el create choca y ensureItem relee.
  await setReaction("user-1", "like", ItemType.MOVIE, "tt123", true);

  assert.equal(creates.length, 1);
  assert.ok(calls.includes(`create:${ActionType.LIKE}`));
});

test("dislike: on borra el me gusta previo y crea el no me gusta", async (t) => {
  const { calls, transactions } = stubPrisma(t, { id: 7 });

  await setReaction("user-1", "dislike", ItemType.SERIES, "tt9", true);

  assert.deepEqual(transactions, [
    [
      { kind: "delete", type: ActionType.LIKE },
      { kind: "delete", type: ActionType.DISLIKE },
      { kind: "create", type: ActionType.DISLIKE },
    ],
  ]);
  assert.equal(calls.length, 3);
});

test("favorite: on no toca like ni dislike", async (t) => {
  const { calls, transactions } = stubPrisma(t, { id: 7 });

  await setReaction("user-1", "favorite", ItemType.MOVIE, "tt5", true);

  assert.deepEqual(calls, [
    `delete:${ActionType.FAVORITE}`,
    `create:${ActionType.FAVORITE}`,
  ]);
  assert.deepEqual(transactions, [
    [
      { kind: "delete", type: ActionType.FAVORITE },
      { kind: "create", type: ActionType.FAVORITE },
    ],
  ]);
});

test("off solo borra la acción indicada, sin crear ni transacción", async (t) => {
  const { calls, transactions } = stubPrisma(t, { id: 7 });

  await setReaction("user-1", "like", ItemType.MOVIE, "tt5", false);

  assert.deepEqual(calls, [`delete:${ActionType.LIKE}`]);
  assert.equal(transactions.length, 0);
});

test("listReactions agrupa por señal, deduplica y omite ítems nulos", async (t) => {
  const findManyResult = [
    { type: ActionType.FAVORITE, item: { externalId: "tt1" } },
    { type: ActionType.FAVORITE, item: { externalId: "tt1" } },
    { type: ActionType.LIKE, item: { externalId: "tt2" } },
    { type: ActionType.DISLIKE, item: { externalId: "tt3" } },
    { type: ActionType.LIKE, item: null },
  ];

  stubPrisma(t, { id: 7 }, findManyResult);

  const reactions = await listReactions("user-1");

  assert.deepEqual(reactions, {
    favorites: ["tt1"],
    likes: ["tt2"],
    dislikes: ["tt3"],
  });
});
