import test from "node:test";
import assert from "node:assert/strict";
import { authCallbackPath } from "../src/lib/auth-redirect";

test("callback permite o painel", () => {
  assert.equal(authCallbackPath("/painel"), "/painel");
});

test("callback permite a atualização de senha", () => {
  assert.equal(authCallbackPath("/recuperar-senha/atualizar"), "/recuperar-senha/atualizar");
});

test("callback rejeita URL externa", () => {
  assert.equal(authCallbackPath("https://site-malicioso.com"), "/painel");
});

test("callback rejeita URL protocol-relative", () => {
  assert.equal(authCallbackPath("//site-malicioso.com"), "/painel");
});
