import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { after, test } from "node:test";

// Solo respuestas que no tocan la base de datos: validación de kind/type/id
// (400, antes incluso de la sesión) y ausencia de sesión de Better Auth (401)
// — plan.md D1/D2 (spec 004).
const { app } = await import("../app");

const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const { port } = server.address() as AddressInfo;
const base = `http://127.0.0.1:${port}`;

after(() => new Promise<void>((resolve) => server.close(() => resolve())));

test("un GET de reacciones sin sesión responde 401 con message", async () => {
  const response = await fetch(`${base}/api/reactions`);

  assert.equal(response.status, 401);

  const body = (await response.json()) as { message?: unknown };
  assert.match(String(body.message), /sesión/i);
});

test("un PUT sin sesión responde 401 con message", async () => {
  const response = await fetch(`${base}/api/reactions/favorite/movie/tt1`, {
    method: "PUT",
  });

  assert.equal(response.status, 401);

  const body = (await response.json()) as { message?: unknown };
  assert.match(String(body.message), /sesión/i);
});

test("un DELETE sin sesión responde 401 con message", async () => {
  const response = await fetch(`${base}/api/reactions/like/series/tt1`, {
    method: "DELETE",
  });

  assert.equal(response.status, 401);

  const body = (await response.json()) as { message?: unknown };
  assert.match(String(body.message), /sesión/i);
});

test("un PUT con kind inválido responde 400 con message", async () => {
  const response = await fetch(`${base}/api/reactions/gusta/movie/tt1`, {
    method: "PUT",
  });

  assert.equal(response.status, 400);

  const body = (await response.json()) as { message?: unknown };
  assert.match(String(body.message), /reacción/i);
});

test("un PUT con type inválido responde 400 con message", async () => {
  const response = await fetch(`${base}/api/reactions/like/book/tt1`, {
    method: "PUT",
  });

  assert.equal(response.status, 400);

  const body = (await response.json()) as { message?: unknown };
  assert.match(String(body.message), /título/i);
});

test("un PUT con id vacío responde 400 con message", async () => {
  const response = await fetch(`${base}/api/reactions/favorite/movie/%20`, {
    method: "PUT",
  });

  assert.equal(response.status, 400);

  const body = (await response.json()) as { message?: unknown };
  assert.match(String(body.message), /ID/i);
});

test("un PUT con id demasiado largo responde 400 con message", async () => {
  const longId = "a".repeat(81);
  const response = await fetch(`${base}/api/reactions/favorite/movie/${longId}`, {
    method: "PUT",
  });

  assert.equal(response.status, 400);

  const body = (await response.json()) as { message?: unknown };
  assert.match(String(body.message), /80/);
});

test("el kind inválido se responde 400 incluso sin sesión", async () => {
  const response = await fetch(`${base}/api/reactions/otra/movie/tt1`, {
    method: "PUT",
  });

  assert.equal(response.status, 400);

  const body = (await response.json()) as { message?: unknown };
  assert.match(String(body.message), /reacción/i);
});
