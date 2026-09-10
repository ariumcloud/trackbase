import test from "node:test";
import assert from "node:assert/strict";
import { isApprovedSaleStatus, isRefundedSaleStatus } from "../src/lib/sale-status";

test("trata todos os status de venda aprovada de forma consistente", () => {
  assert.equal(isApprovedSaleStatus("approved"), true);
  assert.equal(isApprovedSaleStatus("paid"), true);
  assert.equal(isApprovedSaleStatus("completed"), true);
  assert.equal(isApprovedSaleStatus(" PAID "), true);
  assert.equal(isApprovedSaleStatus("pending"), false);
});

test("trata reembolso, chargeback e reembolso parcial sem contar como venda", () => {
  assert.equal(isRefundedSaleStatus("refunded"), true);
  assert.equal(isRefundedSaleStatus("chargeback"), true);
  assert.equal(isRefundedSaleStatus("partial_refund"), true);
  assert.equal(isRefundedSaleStatus("chargedback"), true);
  assert.equal(isRefundedSaleStatus(" CHARGEBACK "), true);
  assert.equal(isRefundedSaleStatus("approved"), false);
});
