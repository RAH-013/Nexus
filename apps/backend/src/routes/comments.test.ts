import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { after, test } from "node:test";

// Solo respuestas que no tocan la base de datos: validación de type (400)
// y ausencia de sesión de Better Auth (401) — plan.md D17.
const { app } = await import("../app");

const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const { port } = server.address() as AddressInfo;
const base = `http://127.0.0.1:${port}`;

after(() => new Promise<void>((resolve) => server.close(() => resolve())));

test("un GET con type inválido responde 400 con error y detalles", async () => {
  const response = await fetch(`${base}/api/comments/book/tt1`);

  assert.equal(response.status, 400);

  const body = (await response.json()) as {
    error?: unknown;
    detalles?: unknown;
  };

  assert.equal(body.error, "Datos inválidos");
  assert.deepEqual(body.detalles, ["El tipo debe ser movie o series"]);
});

test("un GET con commentId inválido responde 400 con error y detalles", async () => {
  const response = await fetch(`${base}/api/comments/movie/tt1/abc`);

  assert.equal(response.status, 400);

  const body = (await response.json()) as {
    error?: unknown;
    detalles?: unknown;
  };

  assert.equal(body.error, "Datos inválidos");
  assert.deepEqual(body.detalles, [
    "El ID del comentario debe ser un entero positivo",
  ]);
});

test("un POST sin sesión responde 401 con error y detalles vacío", async () => {
  const response = await fetch(`${base}/api/comments/movie/tt1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "¡Muy buena!" }),
  });

  assert.equal(response.status, 401);

  const body = (await response.json()) as { error?: unknown; detalles?: unknown };
  assert.equal(body.error, "Inicia sesión para comentar");
  assert.deepEqual(body.detalles, []);
});
