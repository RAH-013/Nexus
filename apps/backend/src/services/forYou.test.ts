import assert from "node:assert/strict";
import { test } from "node:test";

// Sin clave el motor debe caer en la heurística (RF-10): se fija ANTES de
// cargar el módulo (config/env.ts se lee al importar).
process.env.GEMINI_API_KEY = "";

const { cinemetaService } = await import("./cinemeta");
const { ActionType } = await import("../generated/prisma/enums");
const { prisma } = await import("../lib/prisma");
const { deriveFormat, genreWeights, heuristicRank, getForYou } = await import(
  "./forYou"
);
const { RECOMMENDATION_LIMIT } = await import("./gemini");

/** Sustituye un método del singleton de Prisma y devuelve su restaurador. */
function stub(object: object, key: string, value: unknown): () => void {
  const record = object as Record<string, unknown>;
  const original = record[key];

  record[key] = value;

  return () => {
    record[key] = original;
  };
}

test("deriveFormat: proporción de vistos define el formato preferido", () => {
  const movie = { type: "movie" as const };
  const series = { type: "series" as const };

  assert.equal(deriveFormat([]), "mixto");
  assert.equal(deriveFormat([movie, movie, movie, series]), "peliculas");
  assert.equal(deriveFormat([series, series, series, movie]), "series");
  assert.equal(deriveFormat([movie, movie, series, series]), "mixto");
});

test("genreWeights: vistos +1, favoritos/likes +3, dislikes −3", () => {
  const weights = genreWeights({
    format: "mixto",
    watched: [{ id: "tt1", type: "movie", genres: ["Action"] }],
    favorites: [{ id: "tt2", type: "movie", genres: ["Drama"] }],
    likes: [{ id: "tt3", type: "series", genres: ["Drama"] }],
    dislikes: [{ id: "tt4", type: "movie", genres: ["Comedy"] }],
    comments: [],
  });

  assert.equal(weights.get("Action"), 1);
  assert.equal(weights.get("Drama"), 6);
  assert.equal(weights.get("Comedy"), -3);
});

test("heuristicRank: afinidad de géneros y formato dominan el orden", () => {
  const ranked = heuristicRank(
    {
      format: "peliculas",
      watched: [{ id: "tt0", type: "movie", genres: ["Action"] }],
      favorites: [],
      likes: [],
      dislikes: [{ id: "tt9", type: "movie", genres: ["Comedy"] }],
      comments: [],
    },
    [
      { id: "ttA", type: "movie", name: "A", genres: ["Action"] },
      { id: "ttB", type: "series", name: "B", genres: ["Drama"] },
      { id: "ttC", type: "movie", name: "C", genres: ["Comedy"] },
      { id: "ttD", type: "movie", name: "D" },
    ],
  );

  assert.deepEqual(
    ranked.map((entry) => entry.id),
    ["ttA", "ttD", "ttB", "ttC"],
  );
  assert.ok(ranked[0].score > ranked[2].score);
  assert.match(ranked[0].reason, /Action/);
  assert.ok(ranked.every((entry) => entry.reason.length <= 140));
});

test("getForYou sin clave sirve la heurística con candidatos de Cinemeta", async (t) => {
  t.after(stub(prisma.userAction, "findMany", async () => []));
  t.after(
    stub(prisma.comment, "findMany", async () => [
      { id: 1, text: "Muy buena la que vi" },
      { id: 2, text: "No me gustó" },
      { id: 3, text: "Regular" },
    ]),
  );
  t.after(stub(prisma.actorComment, "findMany", async () => []));
  t.after(stub(cinemetaService, "getTitle", async () => null));
  t.after(
    stub(cinemetaService, "getMovieList", async () => [
      { id: "ttM1", type: "movie", name: "Peli Uno", genres: ["Action"] },
      { id: "ttM2", type: "movie", name: "Peli Dos" },
    ]),
  );
  t.after(
    stub(cinemetaService, "getSeriesList", async () => [
      { id: "ttS1", type: "series", name: "Serie Una", genres: ["Drama"] },
    ]),
  );

  const result = await getForYou("usuario-de-prueba");

  assert.equal(result.source, "heuristic");
  assert.equal(result.items.length, 3);
  assert.ok(result.items.every((item) => item.reason.length > 0));
  assert.ok(!Number.isNaN(Date.parse(result.cachedAt)));
});

test("getForYou con menos de 3 señales responde vacío (source empty)", async (t) => {
  t.after(stub(prisma.userAction, "findMany", async () => []));
  t.after(
    stub(prisma.comment, "findMany", async () => [{ id: 1, text: "Una sola" }]),
  );
  t.after(stub(prisma.actorComment, "findMany", async () => []));
  t.after(
    stub(cinemetaService, "getMovieList", async () => {
      throw new Error("no debería pedirse ningún catálogo");
    }),
  );
  t.after(
    stub(cinemetaService, "getSeriesList", async () => {
      throw new Error("no debería pedirse ningún catálogo");
    }),
  );

  const result = await getForYou("usuario-nuevo");

  assert.equal(result.source, "empty");
  assert.deepEqual(result.items, []);
});

test("la poda que llega al modelo respeta el tope de candidatos", async (t) => {
  t.after(stub(prisma.userAction, "findMany", async () => []));
  t.after(
    stub(prisma.comment, "findMany", async () => [
      { id: 1, text: "a" },
      { id: 2, text: "b" },
      { id: 3, text: "c" },
    ]),
  );
  t.after(stub(prisma.actorComment, "findMany", async () => []));
  t.after(stub(cinemetaService, "getTitle", async () => null));
  t.after(
    stub(cinemetaService, "getMovieList", async () =>
      Array.from({ length: 80 }, (_unused, index) => ({
        id: `tt${index}`,
        type: "movie" as const,
        name: `Película ${index}`,
      })),
    ),
  );
  t.after(stub(cinemetaService, "getSeriesList", async () => []));

  const result = await getForYou("usuario-llena");

  // El tope final es el de la ficha, aunque el catálogo traiga 80.
  assert.ok(result.items.length <= RECOMMENDATION_LIMIT);
});

test("el tipo de acción del enum coincide con las reacciones guardadas", () => {
  // Regresión mínima del contrato de la Fase 1: los tipos que lee el motor
  // son exactos los que escribe `services/reactions.ts`.
  assert.equal(ActionType.VIEW, "VIEW");
  assert.equal(ActionType.FAVORITE, "FAVORITE");
  assert.equal(ActionType.LIKE, "LIKE");
  assert.equal(ActionType.DISLIKE, "DISLIKE");
});
