import assert from "node:assert/strict";
import { test } from "node:test";

import { validateCommentText } from "./comments";

test("rechaza los valores que no son texto", () => {
  assert.deepEqual(validateCommentText(undefined), { ok: false, reason: "invalid" });
  assert.deepEqual(validateCommentText(null), { ok: false, reason: "invalid" });
  assert.deepEqual(validateCommentText(42), { ok: false, reason: "invalid" });
  assert.deepEqual(validateCommentText({ text: "hola" }), { ok: false, reason: "invalid" });
});

test("rechaza el texto vacío o solo espacios", () => {
  assert.deepEqual(validateCommentText(""), { ok: false, reason: "empty" });
  assert.deepEqual(validateCommentText("   \n  "), { ok: false, reason: "empty" });
});

test("acepta 500 caracteres y rechaza 501", () => {
  const quinientos = "a".repeat(500);

  assert.deepEqual(validateCommentText(quinientos), { ok: true, text: quinientos });
  assert.deepEqual(validateCommentText("a".repeat(501)), { ok: false, reason: "too-long" });
});

test("guarda el texto con los espacios sobrantes recortados", () => {
  assert.deepEqual(validateCommentText("  ¡Muy buena! \n"), {
    ok: true,
    text: "¡Muy buena!",
  });
});
