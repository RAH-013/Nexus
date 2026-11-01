import test from "node:test";
import assert from "node:assert/strict";
import { analyzeSentiment } from "./sentiment";

test("analizador de sentimientos clasifica opiniones positivas", () => {
  assert.equal(analyzeSentiment("Una obra maestra absoluta, me encantó"), "positivo");
  assert.equal(analyzeSentiment("Excelente película, muy buena"), "positivo");
  assert.equal(analyzeSentiment("Genial actuación y fascinante historia"), "positivo");
});

test("analizador de sentimientos clasifica opiniones negativas", () => {
  assert.equal(analyzeSentiment("Una completa pérdida de tiempo, aburrida y pésima"), "negativo");
  assert.equal(analyzeSentiment("Horrible guion, no me gustó nada"), "negativo");
  assert.equal(analyzeSentiment("Un desastre total y mediocre"), "negativo");
});

test("analizador de sentimientos maneja negaciones correctamente", () => {
  assert.equal(analyzeSentiment("No es buena película"), "negativo");
  assert.equal(analyzeSentiment("Nada recomendable"), "negativo");
});

test("analizador de sentimientos clasifica texto ambiguo o neutro como neutro", () => {
  assert.equal(analyzeSentiment("La película dura dos horas y se filmó en España"), "neutro");
  assert.equal(analyzeSentiment(""), "neutro");
});
