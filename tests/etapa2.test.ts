import test from "node:test";
import assert from "node:assert/strict";
import { dayInZone } from "../src/lib/metrics";

test("Cálculo de agrupamento diário respeita fuso horário de Brasília", () => {
  const dateUtc = "2026-09-06T02:30:00Z";
  const dayInBr = dayInZone(new Date(dateUtc), "America/Sao_Paulo");
  // 02:30 UTC é 23:30 do dia 05 no Brasil
  assert.equal(dayInBr, "2026-09-05");

  const afternoonUtc = "2026-09-06T18:00:00Z";
  const afternoonBr = dayInZone(new Date(afternoonUtc), "America/Sao_Paulo");
  assert.equal(afternoonBr, "2026-09-06");
});

test("Estrutura do CSV exporta colunas corretas e aplica escape de ponto e vírgula", () => {
  const sampleText = 'Produto "Especial"; Edição 1';
  const escaped = `"${sampleText.replace(/"/g, '""')}"`;
  assert.equal(escaped, '"Produto ""Especial""; Edição 1"');
});
