import assert from "node:assert/strict";
import { test } from "node:test";
import {
  convertLifetimeRevenue,
  resolveRevenueMilestone,
} from "../src/lib/revenue-milestones";

test("seleciona a próxima faixa e limita o progresso na meta máxima", () => {
  assert.deepEqual(resolveRevenueMilestone(0), {
    total: 0,
    target: 1_000_000,
    progress: 0,
    maximumReached: false,
  });
  assert.equal(resolveRevenueMilestone(1_000_000).target, 5_000_000);
  assert.equal(resolveRevenueMilestone(1_000_000).progress, 20);
  assert.equal(resolveRevenueMilestone(1_000_000_001).target, 1_000_000_000);
  assert.equal(resolveRevenueMilestone(1_000_000_001).progress, 100);
  assert.equal(resolveRevenueMilestone(1_000_000_001).maximumReached, true);
});

test("converte os totais agrupados para a moeda padrão do workspace", () => {
  const rows = [
    { currency: "BRL", gross_revenue: 1_000 },
    { currency: "USD", gross_revenue: 100 },
  ];
  assert.equal(
    convertLifetimeRevenue(rows, "BRL", { USD: 1, BRL: 5.5 }),
    1_550,
  );
  assert.equal(convertLifetimeRevenue(rows, "BRL", null), null);
  assert.equal(convertLifetimeRevenue([], "BRL", null), 0);
});
