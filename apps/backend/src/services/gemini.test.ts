import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

// La clave se finge ANTES de cargar el módulo (config/env.ts se lee al
// importar); así el servicio cree que hay integración disponible.
process.env.GEMINI_API_KEY = "test-key";
process.env.GEMINI_MODELS = "modelo-a,modelo-b";

const { buildPrompt, geminiRecommend, parseGeminiResponse } = await import(
  "./gemini"
);

const candidates = [
  { id: "tt1", type: "movie" as const, name: "Uno" },
  { id: "tt2", type: "series" as const, name: "Dos" },
];

const emptyProfile = {
  format: "mixto" as const,
  watched: [],
  favorites: [],
  likes: [],
  dislikes: [],
  comments: [],
};

/** Respuesta 200 de Gemini con el texto indicado dentro del candidato. */
function okResponse(text: string): Response {
  return {
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text }] } }],
    }),
  } as unknown as Response;
}

function errorResponse(status: number): Response {
  return {
    ok: false,
    status,
    statusText: "",
    json: async () => ({}),
  } as unknown as Response;
}

/** Sustituye `fetch` registrando las URLs; devuelve las llamadas. */
function mockFetch(
  t: TestContext,
  handler: (url: string, init?: RequestInit) => Response,
): string[] {
  const urls: string[] = [];

  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    urls.push(String(input));
    return handler(String(input), init);
  });

  return urls;
}

test("parseGeminiResponse valida ids, clamps, trunca y tolera comentarios malos", () => {
  const text = JSON.stringify({
    recomendaciones: [
      { id: "tt1", score: 95, reason: "Razón buena" },
      { id: "tt-fuera", score: 90, reason: "No debería estar" },
      { id: "tt1", score: 80, reason: "Repetido" },
      { id: "tt2", score: 150, reason: "x".repeat(200) },
      { id: "tt2", score: 10, reason: "Otro repetido" },
    ],
    comentarios: [
      { id: 1, fuente: "titulo", sentimiento: "positivo" },
      { id: 2, fuente: "actor", sentimiento: "ok" },
      { id: "x", fuente: "titulo", sentimiento: "negativo" },
    ],
  });

  const result = parseGeminiResponse(text, candidates);

  assert.equal(result.recommendations.length, 2);
  assert.equal(result.recommendations[0].id, "tt1");
  assert.equal(result.recommendations[0].score, 95);
  assert.equal(result.recommendations[1].id, "tt2");
  assert.equal(result.recommendations[1].score, 100);
  assert.equal(result.recommendations[1].reason.length, 140);

  // Solo el comentario válido; el bloque malo parcial no rompe nada.
  assert.deepEqual(result.sentiments, [
    { id: 1, fuente: "titulo", sentiment: "positivo" },
  ]);
});

test("parseGeminiResponse lanza con JSON ilegible o sin recomendaciones", () => {
  assert.throws(() => parseGeminiResponse("{{{", candidates));
  assert.throws(() => parseGeminiResponse('{"algo": []}', candidates));
});

test("geminiRecommend pasa al siguiente modelo si el primero responde 429", async (t) => {
  const urls = mockFetch(t, (url) =>
    url.includes("modelo-a") ? errorResponse(429) : okResponse(JSON.stringify({
      recomendaciones: [{ id: "tt1", score: 88, reason: "Porque te gustó Uno" }],
    })),
  );

  const result = await geminiRecommend(emptyProfile, candidates);

  assert.equal(result.recommendations.length, 1);
  assert.equal(result.recommendations[0].id, "tt1");
  assert.deepEqual(
    urls.map((url) => (url.includes("modelo-a") ? "a" : "b")),
    ["a", "b"],
  );
});

test("geminiRecommend pasa al siguiente modelo si el primero devuelve JSON roto", async (t) => {
  mockFetch(t, (url) =>
    url.includes("modelo-a")
      ? okResponse("esto no es json")
      : okResponse(JSON.stringify({ recommendations: [{ id: "tt2", score: 70, reason: "ok" }] })),
  );

  const result = await geminiRecommend(emptyProfile, candidates);

  assert.equal(result.recommendations[0].id, "tt2");
});

test("geminiRecommend lanza si se agotan todos los modelos", async (t) => {
  mockFetch(t, () => errorResponse(429));

  await assert.rejects(() => geminiRecommend(emptyProfile, candidates));
});

test("el prompt incluye el perfil y los candidatos, en español", () => {
  const prompt = buildPrompt(
    { ...emptyProfile, format: "series", watched: [{ id: "tt9", type: "series", name: "Vista" }] },
    candidates,
  );

  assert.match(prompt, /formato_preferido/);
  assert.match(prompt, /Vista/);
  assert.match(prompt, /Candidatos/);
  assert.match(prompt, /recomendaciones/);
});
