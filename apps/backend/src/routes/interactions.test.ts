import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { app } from "../app";

function withServer(fn: (baseUrl: string) => Promise<void>): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = createServer(app);
    server.listen(0, "127.0.0.1", async () => {
      const { port } = server.address() as AddressInfo;
      const baseUrl = `http://127.0.0.1:${port}`;
      try {
        await fn(baseUrl);
        server.close(() => resolve());
      } catch (err) {
        server.close(() => reject(err));
      }
    });
  });
}

test("interacciones: POST detail sin sesión responde 401", () =>
  withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/interactions/detail/movie/tt1234567`, {
      method: "POST",
    });
    assert.equal(res.status, 401);
  }));

test("interacciones: POST impression sin sesión responde 401", () =>
  withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/interactions/impression`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ type: "movie", id: "tt1234567" }] }),
    });
    assert.equal(res.status, 401);
  }));

test("interacciones: PUT rating sin sesión responde 401", () =>
  withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/interactions/rating/movie/tt1234567`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: 5 }),
    });
    assert.equal(res.status, 401);
  }));

test("interacciones: PUT not-interested sin sesión responde 401", () =>
  withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/interactions/not-interested/movie/tt1234567`, {
      method: "PUT",
    });
    assert.equal(res.status, 401);
  }));

test("interacciones: GET not-interested sin sesión responde 401", () =>
  withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/interactions/not-interested`);
    assert.equal(res.status, 401);
  }));
