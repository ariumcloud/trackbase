import test from "node:test";
import assert from "node:assert/strict";
import { serializeAssistantContext } from "../src/lib/assistant-context";

test("contexto do Assistente remove PII e limita campos volumosos", () => {
  const context = serializeAssistantContext({
    metrics: { purchases: 12, spend: 99.5 },
    buyer: { email: "pessoa@example.com", phone: "+5511999999999" },
    landing_url: "https://private.example/checkout",
    nested: { customerName: "Pessoa" },
    items: Array.from({ length: 70 }, (_, index) => index),
  }, 10_000);

  assert.ok(!context.includes("pessoa@example.com"));
  assert.ok(!context.includes("private.example"));
  assert.ok(!context.includes("Pessoa"));
  assert.equal(JSON.parse(context).items.length, 50);
});

test("contexto do Assistente rejeita conteúdo além do orçamento", () => {
  assert.throws(
    () => serializeAssistantContext({ notes: "a".repeat(501) }, 100),
    /CONTEXT_TOO_LARGE/,
  );
});
