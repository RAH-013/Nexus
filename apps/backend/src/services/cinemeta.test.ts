import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

import {
  alternateTypes,
  cinemetaService,
  extractYear,
  filterByGenre,
  limitResults,
  normalizeQuery,
  toCatalogItem,
  toTitleDetail,
  type CinemetaCatalogItem,
} from "./cinemeta";

function buildList(
  type: "movie" | "series",
  count: number,
  genres: string[] = ["Drama"],
): CinemetaCatalogItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `tt${type}${index}`,
    type,
    name: `${type === "movie" ? "Película" : "Serie"} ${index}`,
    poster: `https://img.example/${type}-${index}.jpg`,
    releaseInfo: `${2000 + index}`,
    genres,
  }));
}

function mockSource(t: TestContext, handler: (url: string) => Response): void {
  t.mock.method(
    globalThis,
    "fetch",
    async (input: RequestInfo | URL): Promise<Response> => handler(String(input)),
  );
}

test("intercala películas y series conservando el orden de cada tipo", () => {
  const movies = [{ id: "m1" }, { id: "m2" }, { id: "m3" }];
  const series = [{ id: "s1" }, { id: "s2" }];

  assert.deepEqual(alternateTypes(movies, series), [
    { id: "m1" },
    { id: "s1" },
    { id: "m2" },
    { id: "s2" },
    { id: "m3" },
  ]);
});

test("rellena con la lista más larga cuando la otra se agota", () => {
  assert.deepEqual(alternateTypes(["a"], ["b", "c", "d"]), ["a", "b", "c", "d"]);
  assert.deepEqual(alternateTypes(["a", "b"], ["c"]), ["a", "c", "b"]);
});

test("con una lista vacía devuelve la otra sin cambiar", () => {
  assert.deepEqual(alternateTypes(["a", "b"], []), ["a", "b"]);
  assert.deepEqual(alternateTypes([], []), []);
});

test("filtra por género en inglés y devuelve vacío si no hay coincidencias", () => {
  const items = [
    { id: "m1", genres: ["Action", "Adventure"] },
    { id: "m2", genres: ["Drama"] },
    { id: "s1", genres: ["Action"] },
  ] as CinemetaCatalogItem[];

  assert.deepEqual(
    filterByGenre(items, "Action").map((item) => item.id),
    ["m1", "s1"],
  );
  assert.deepEqual(filterByGenre(items, "Horror"), []);
});

test("no deduplica títulos repetidos dentro del mismo filtro", () => {
  const items = [
    { id: "tt1", genres: ["Action"] },
    { id: "tt1", genres: ["Action"] },
  ] as CinemetaCatalogItem[];

  assert.equal(filterByGenre(items, "Action").length, 2);
});

test("normaliza mayúsculas, acentos y espacios sobrantes", () => {
  assert.equal(normalizeQuery("  ÁccióN   de TERROR "), "accion de terror");
  assert.equal(normalizeQuery("ÉL ÚLTIMO"), "el ultimo");
  assert.equal(normalizeQuery("matrix"), "matrix");
});

test("extrae el año inicial de releaseInfo", () => {
  assert.equal(extractYear("2008-2013"), "2008");
  assert.equal(extractYear(" 2019"), "2019");
  assert.equal(extractYear("N/A"), undefined);
  assert.equal(extractYear(), undefined);
});

test("omite year y poster cuando la fuente no los trae", () => {
  const sinDatos = toCatalogItem({ id: "tt1", type: "movie", name: "Sin datos" });

  assert.equal("year" in sinDatos, false);
  assert.equal("poster" in sinDatos, false);

  const conDatos = toCatalogItem({
    id: "tt2",
    type: "series",
    name: "Con año",
    poster: "https://img.example/portada.jpg",
    releaseInfo: "2008-2013",
  });

  assert.equal(conDatos.year, "2008");
  assert.equal(conDatos.poster, "https://img.example/portada.jpg");
});

test("recorta a 10 resultados y marca cuando hay más", () => {
  const items = Array.from({ length: 11 }, (_, index) => ({
    id: `tt${index}`,
    type: "movie" as const,
    name: `Película ${index}`,
  }));

  const recortados = limitResults(items);
  assert.equal(recortados.results.length, 10);
  assert.equal(recortados.hasMore, true);

  assert.equal(limitResults(items.slice(0, 10)).hasMore, false);
  assert.equal(limitResults(items.slice(0, 3)).hasMore, false);
  assert.equal(limitResults(items.slice(0, 3)).results.length, 3);
});

test("featured devuelve 10 destacados con películas y series alternadas", async (t) => {
  mockSource(t, (url) => {
    if (url.includes("/catalog/movie/top.json")) {
      return Response.json({ metas: buildList("movie", 49) });
    }

    if (url.includes("/catalog/series/top.json")) {
      return Response.json({ metas: buildList("series", 50) });
    }

    return Response.json({ metas: [] });
  });

  const items = await cinemetaService.getCollection("featured");

  assert.equal(items.length, 10);
  assert.deepEqual(
    items.map((item) => item.type),
    [
      "movie",
      "series",
      "movie",
      "series",
      "movie",
      "series",
      "movie",
      "series",
      "movie",
      "series",
    ],
  );
});

test("trending devuelve los 200 títulos alternando tipos", async (t) => {
  mockSource(t, (url) => {
    if (url.includes("/catalog/movie/trending.json")) {
      return Response.json({ metas: buildList("movie", 100) });
    }

    if (url.includes("/catalog/series/trending.json")) {
      return Response.json({ metas: buildList("series", 100) });
    }

    return Response.json({ metas: [] });
  });

  const items = await cinemetaService.getCollection("trending");

  assert.equal(items.length, 200);
  assert.equal(items[0].type, "movie");
  assert.equal(items[1].type, "series");
  assert.equal(items[199].type, "series");
});

test("la colección de género solo devuelve títulos de ese género", async (t) => {
  mockSource(t, (url) => {
    if (url.includes("/catalog/movie/trending.json")) {
      return Response.json({
        metas: [
          {
            id: "m-accion",
            type: "movie",
            name: "Perdidos en acción",
            genres: ["Action"],
          },
          { id: "m-drama", type: "movie", name: "Drama antiguo", genres: ["Drama"] },
        ],
      });
    }

    if (url.includes("/catalog/series/trending.json")) {
      return Response.json({
        metas: [
          { id: "s-accion", type: "series", name: "Serie de acción", genres: ["Action"] },
          { id: "s-comedia", type: "series", name: "Comedia", genres: ["Comedy"] },
        ],
      });
    }

    return Response.json({ metas: [] });
  });

  const items = await cinemetaService.getCollection("action");

  assert.deepEqual(
    items.map((item) => item.id),
    ["m-accion", "s-accion"],
  );
});

test("la búsqueda fusiona películas y series y normaliza el texto", async (t) => {
  const requested: string[] = [];

  mockSource(t, (url) => {
    requested.push(url);

    if (url.includes("/catalog/movie/")) {
      return Response.json({ metas: buildList("movie", 3, ["Action"]) });
    }

    if (url.includes("/catalog/series/")) {
      return Response.json({ metas: buildList("series", 3, ["Action"]) });
    }

    return Response.json({ metas: [] });
  });

  const search = await cinemetaService.search("all", "  ACCIÓN ");

  assert.equal(search.type, "all");
  assert.equal(search.hasMore, false);
  assert.equal(search.results.length, 6);
  assert.deepEqual(
    search.results.map((item) => item.type),
    ["movie", "series", "movie", "series", "movie", "series"],
  );
  assert.ok(requested.length > 0);
  assert.ok(
    requested.every((url) => url.includes("search=accion")),
    `la fuente recibe el texto normalizado: ${requested.join(" | ")}`,
  );
});

test("si la fuente responde con un error 5xx se propaga el fallo", (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async (): Promise<Response> =>
      new Response("fallo", { status: 503, statusText: "Service Unavailable" }),
  );

  return assert.rejects(
    () => cinemetaService.getCollection("trending"),
    /Cinemeta request failed/,
  );
});

test("si la fuente devuelve algo ilegible también se propaga el fallo", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async (): Promise<Response> =>
      new Response("<html>no soy json</html>", { status: 200 }),
  );

  await assert.rejects(
    () => cinemetaService.getCollection("trending"),
    (error: unknown) => error instanceof Error,
  );
});

test("una meta completa se normaliza a los campos de la ficha", () => {
  const detalle = toTitleDetail({
    id: "tt0371746",
    type: "movie",
    name: "The Dark Knight",
    poster: "https://img.example/dark-knight.jpg",
    description: "Batman se enfrenta al Joker.",
    releaseInfo: "2008",
    runtime: "152 min",
    imdbRating: "9.0",
    genres: ["Action", "Crime"],
    director: ["Christopher Nolan"],
    cast: ["Christian Bale", "Heath Ledger"],
    trailers: [{ source: "EXdPf2o7lIY" }],
    // Campos que la fuente entrega y la ficha ignora: no deben filtrarse.
    links: [{ id: "imdb", name: "IMDb" }],
    popularity: 99,
  });

  assert.deepEqual(detalle, {
    id: "tt0371746",
    type: "movie",
    name: "The Dark Knight",
    poster: "https://img.example/dark-knight.jpg",
    description: "Batman se enfrenta al Joker.",
    year: "2008",
    runtime: "152 min",
    imdbRating: "9.0",
    genres: ["Action", "Crime"],
    director: ["Christopher Nolan"],
    cast: ["Christian Bale", "Heath Ledger"],
    trailerSource: "EXdPf2o7lIY",
  });
});

test("una meta sin name devuelve null (el caso de tt0000000)", () => {
  assert.equal(toTitleDetail({ id: "tt0000000", type: "movie" }), null);
  assert.equal(toTitleDetail(undefined), null);
});

test("extrae el año inicial de releaseInfo y lo omite cuando no hay año", () => {
  const conRango = toTitleDetail({
    id: "tt1",
    type: "series",
    name: "Serie de prueba",
    releaseInfo: "2008-2013",
  });

  assert.ok(conRango);
  assert.equal(conRango.year, "2008");

  const sinAnio = toTitleDetail({ id: "tt2", type: "movie", name: "Película sin año" });

  assert.ok(sinAnio);
  assert.equal("year" in sinAnio, false);
});

test("toma el primer tráiler con source y omite trailerSource si no hay ninguno", () => {
  const conTrailer = toTitleDetail({
    id: "tt1",
    type: "movie",
    name: "Película con tráiler",
    trailers: [{}, { source: "abc123" }],
  });

  assert.ok(conTrailer);
  assert.equal(conTrailer.trailerSource, "abc123");

  const sinSource = toTitleDetail({
    id: "tt2",
    type: "movie",
    name: "Película sin source",
    trailers: [{}],
  });

  assert.ok(sinSource);
  assert.equal("trailerSource" in sinSource, false);

  const sinLista = toTitleDetail({ id: "tt3", type: "movie", name: "Película" });

  assert.ok(sinLista);
  assert.equal("trailerSource" in sinLista, false);
});

test("omite los campos opcionales que la fuente no trae", () => {
  const minima = toTitleDetail({ id: "tt1", type: "movie", name: "Mínima" });

  assert.ok(minima);
  assert.deepEqual(Object.keys(minima).sort(), ["id", "name", "type"]);
});
