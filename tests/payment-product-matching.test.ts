import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hotmartProductNamesMatch,
  normalizeComparableProductName,
} from "../src/lib/payment-product-matching";

test("normaliza o prefixo do provedor e acentos para comparar produtos Hotmart", () => {
  assert.equal(
    normalizeComparableProductName("HOTMART · Mapas Mentales de Ortopedia"),
    "mapas mentales de ortopedia",
  );
  assert.equal(
    hotmartProductNamesMatch(
      "HOTMART · +250 Mapas Mentales de Ortopedia y Traumatología + Bônus",
      "+250 Mapas Mentales de Ortopedia y Traumatologia + Bonus",
    ),
    true,
  );
});

test("não faz fallback quando o produto é diferente", () => {
  assert.equal(
    hotmartProductNamesMatch("HOTMART · Produto A", "Produto B"),
    false,
  );
  assert.equal(hotmartProductNamesMatch("", "Produto B"), false);
});
