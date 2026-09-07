import test from "node:test";
import assert from "node:assert/strict";
import { GOOGLE_ADS_SCOPE, META_ADS_READ_SCOPE } from "../src/lib/oauth-scopes";

test("OAuth pede somente os escopos mínimos de leitura necessários", () => {
  assert.equal(META_ADS_READ_SCOPE, "ads_read,business_management");
  assert.equal(GOOGLE_ADS_SCOPE, "https://www.googleapis.com/auth/adwords");
  assert.ok(!GOOGLE_ADS_SCOPE.includes("email"));
  assert.ok(!GOOGLE_ADS_SCOPE.includes("profile"));
});
