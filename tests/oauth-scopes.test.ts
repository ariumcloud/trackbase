import test from "node:test";
import assert from "node:assert/strict";
import { GOOGLE_ADS_SCOPE, META_ADS_READ_SCOPE } from "../src/lib/oauth-scopes";

test("OAuth pede leitura, controle de status e Business Manager sem escopos de publicação", () => {
  assert.equal(META_ADS_READ_SCOPE, "ads_read,ads_management,business_management");
  assert.ok(META_ADS_READ_SCOPE.includes("ads_management"));
  assert.equal(GOOGLE_ADS_SCOPE, "https://www.googleapis.com/auth/adwords");
  assert.ok(!GOOGLE_ADS_SCOPE.includes("email"));
  assert.ok(!GOOGLE_ADS_SCOPE.includes("profile"));
});
