import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { after, test, type TestContext } from "node:test";

// La fuente se apunta a un host inexistente ANTES de cargar la app:
// config/env.ts se lee al importar (ver plan.md D15). Así el caso de
// fallo real (502) se prueba sin tocar el código.
process.env.CINEMETA_BASE_URL = "http://127.0.0.1:9";

const { app } = await import("../app");

// fetch real para hablar con el servidor de prueba: si un test sustituye
// globalThis.fetch (fuente simulada), nuestras peticiones locales no se ven.
const realFetch = globalThis.fetch;

const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const { port } = server.address() as AddressInfo;
const base = `http://127.0.0.1:${port}`;

after(() => new Promise<void>((resolve) => server.close(() => resolve())));

function get(path: string): Promise<Response> {
  return realFetch(`${base}${path}`);
}

function mockSource(t: TestContext, handler: (url: string) => Response): void {
  t.mock.method(
    globalThis,
    "fetch",
    async (input: RequestInfo | URL): Promise<Response> => handler(String(input)),
  );
}

test("una colección fuera de la lista blanca responde 400 con message", async () => {
  const response = await get("/api/cinemeta/catalog/no-existe");

  assert.equal(response.status, 400);

  const body = (await response.json()) as { message?: unknown };
  assert.match(String(body.message), /colección/i);
});

test("una colección válida responde 200 con id, type, name, poster y year", async (t) => {
  mockSource(t, (url) => {
    if (url.includes("/catalog/movie/top.json") || url.includes("/catalog/movie/trending.json")) {
      return Response.json({
        metas: [
          {
            id: "tt-movie",
            type: "movie",
            name: "Película de prueba",
            poster: "https://img.example/movie.jpg",
            releaseInfo: "2011-2015",
            genres: ["Action"],
          },
        ],
      });
    }

    if (url.includes("/catalog/series/top.json") || url.includes("/catalog/series/trending.json")) {
      return Response.json({
        metas: [
          {
            id: "tt-series",
            type: "series",
            name: "Serie de prueba",
            poster: "https://img.example/series.jpg",
            releaseInfo: "2008",
            genres: ["Drama"],
          },
        ],
      });
    }

    return Response.json({ metas: [] });
  });

  const response = await get("/api/cinemeta/catalog/featured");

  assert.equal(response.status, 200);

  const items = (await response.json()) as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(items));
  assert.equal(items.length, 2);

  const first = items[0];
  assert.ok(typeof first.id === "string");
  assert.ok(first.type === "movie" || first.type === "series");
  assert.ok(typeof first.name === "string");
  assert.ok(typeof first.poster === "string");
  assert.ok(typeof first.year === "string");
});

test("una búsqueda sin q responde 400 con message", async () => {
  const response = await get("/api/cinemeta/search?q=");

  assert.equal(response.status, 400);

  const body = (await response.json()) as { message?: unknown };
  assert.match(String(body.message), /q/i);
});

test("una búsqueda con más de 80 caracteres responde 400", async () => {
  const response = await get(`/api/cinemeta/search?q=${"a".repeat(81)}`);

  assert.equal(response.status, 400);

  const body = (await response.json()) as { message?: unknown };
  assert.match(String(body.message), /80/);
});

test("un tipo de búsqueda no permitido responde 400 con el mensaje actualizado", async () => {
  const response = await get("/api/cinemeta/search?type=book&q=matrix");

  assert.equal(response.status, 400);

  const body = (await response.json()) as { message?: unknown };
  assert.match(String(body.message), /movie/);
  assert.match(String(body.message), /all/);
});

test("si la fuente no responde la colección responde 502 con message", async () => {
  const response = await get("/api/cinemeta/catalog/trending");

  assert.equal(response.status, 502);

  const body = (await response.json()) as { message?: unknown };
  assert.ok(typeof body.message === "string" && body.message.length > 0);
});

test("la búsqueda devuelve como mucho 10 resultados y avisa de que hay más", async (t) => {
  mockSource(t, (url) => {
    const metas = Array.from({ length: 8 }, (_, index) => ({
      id: `tt${url.includes("/movie/") ? "m" : "s"}${index}`,
      type: url.includes("/movie/") ? "movie" : "series",
      name: `Resultado ${index}`,
      poster: `https://img.example/${index}.jpg`,
      releaseInfo: `${2001 + index}`,
      genres: ["Action"],
    }));

    if (url.includes("/search=")) {
      return Response.json({ metas });
    }

    return Response.json({ metas: [] });
  });

  const response = await get("/api/cinemeta/search?q=matrix");

  assert.equal(response.status, 200);

  const body = (await response.json()) as {
    results?: unknown;
    hasMore?: unknown;
    type?: unknown;
  };

  assert.ok(Array.isArray(body.results));
  assert.equal((body.results as unknown[]).length, 10);
  assert.equal(body.hasMore, true);
  assert.equal(body.type, "all");
});

test("un tipo de ficha no permitido responde 400 con message", async () => {
  const response = await get("/api/cinemeta/book/tt1");

  assert.equal(response.status, 400);

  const body = (await response.json()) as { message?: unknown };
  assert.match(String(body.message), /movie/);
  assert.match(String(body.message), /series/);
});

test("un id vacío en la ficha responde 400 con message", async () => {
  const response = await get("/api/cinemeta/movie/%20");

  assert.equal(response.status, 400);

  const body = (await response.json()) as { message?: unknown };
  assert.ok(typeof body.message === "string" && body.message.length > 0);
});

test("una meta sin name responde 404 con message (stub de fuente simulada)", async (t) => {
  mockSource(t, () =>
    Response.json({
      meta: { id: "tt0000000", type: "movie", behaviorHints: { country: "US" } },
    }),
  );

  const response = await get("/api/cinemeta/movie/tt0000000");

  assert.equal(response.status, 404);

  const body = (await response.json()) as { message?: unknown };
  assert.ok(typeof body.message === "string" && body.message.length > 0);
});

test("una ficha completa responde 200 con el objeto normalizado", async (t) => {
  mockSource(t, (url) => {
    if (url.includes("/meta/movie/tt-completa.json")) {
      return Response.json({
        meta: {
          id: "tt-completa",
          type: "movie",
          name: "Película completa",
          poster: "https://img.example/completa.jpg",
          description: "Una película de prueba.",
          releaseInfo: "2010",
          runtime: "120 min",
          imdbRating: "8.2",
          genres: ["Action"],
          director: ["Director de prueba"],
          cast: ["Actor uno", "Actor dos"],
          trailers: [{ source: "xyz789" }],
          popularity: 42,
        },
      });
    }

    return Response.json({});
  });

  const response = await get("/api/cinemeta/movie/tt-completa");

  assert.equal(response.status, 200);

  const body = (await response.json()) as Record<string, unknown>;
  assert.equal(body.name, "Película completa");
  assert.equal(body.year, "2010");
  assert.equal(body.trailerSource, "xyz789");
  assert.deepEqual(body.genres, ["Action"]);
  assert.equal("popularity" in body, false);
  assert.equal("releaseInfo" in body, false);
});

test("una lista de películas fuera de la blanca responde 400 con message", async () => {
  const response = await get("/api/cinemeta/movies/no-existe");

  assert.equal(response.status, 400);

  const body = (await response.json()) as { message?: unknown };
  assert.match(String(body.message), /lista/i);
});

test("si la fuente no responde la lista responde 502 con message", async () => {
  // Sin mock: CINEMETA_BASE_URL apunta a un host inexistente (ver cabecera).
  const response = await get("/api/cinemeta/movies/trending");

  assert.equal(response.status, 502);

  const body = (await response.json()) as { message?: unknown };
  assert.ok(typeof body.message === "string" && body.message.length > 0);
});

test("una lista válida responde 200 con el array de películas y sus géneros", async (t) => {
  mockSource(t, (url) => {
    if (url.includes("/catalog/movie/trending.json")) {
      return Response.json({
        metas: [
          {
            id: "tt-movie",
            type: "movie",
            name: "Película de prueba",
            poster: "https://img.example/movie.jpg",
            releaseInfo: "2011",
            genres: ["Action"],
          },
        ],
      });
    }

    return Response.json({ metas: [] });
  });

  const response = await get("/api/cinemeta/movies/trending");

  assert.equal(response.status, 200);

  const items = (await response.json()) as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(items));
  assert.equal(items.length, 1);
  assert.equal(items[0].id, "tt-movie");
  assert.deepEqual(items[0].genres, ["Action"]);
});

test("un limit fuera de rango responde 400 con message", async () => {
  const response = await get("/api/cinemeta/search?q=matrix&limit=0");

  assert.equal(response.status, 400);

  const body = (await response.json()) as { message?: unknown };
  assert.match(String(body.message), /limit/i);
});

test("con limit la respuesta respeta el tope pedido", async (t) => {
  mockSource(t, (url) => {
    if (url.includes("/search=")) {
      const metas = Array.from({ length: 12 }, (_, index) => ({
        id: `tt-limit${index}`,
        type: "movie",
        name: `Resultado ${index}`,
        poster: `https://img.example/${index}.jpg`,
        releaseInfo: `${2001 + index}`,
        genres: ["Action"],
      }));

      return Response.json({ metas });
    }

    return Response.json({ metas: [] });
  });

  const response = await get("/api/cinemeta/search?q=matrix&limit=5");

  assert.equal(response.status, 200);

  const body = (await response.json()) as { results?: unknown; hasMore?: unknown };
  assert.equal((body.results as unknown[]).length, 5);
  assert.equal(body.hasMore, true);
});

test("al superar el límite de peticiones la respuesta es 429", async () => {
  let limited = false;

  for (let index = 0; index < 320 && !limited; index += 1) {
    const response = await get("/health");

    if (response.status === 429) {
      limited = true;
    } else {
      assert.equal(response.status, 200);
    }
  }

  assert.ok(limited, "llega la respuesta 429 antes de agotar el bucle");
});
