import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { createCheckoutUrlMatcher, matchingCheckoutOffers, matchesCheckoutUrl, normalizeCheckoutUrl } from "../src/lib/tracker";

test("configured checkout supports Wiapy and the existing gateways without a global allowlist", () => {
  for (const host of ["pay.wiapy.com", "pay.hotmart.com", "pay.kiwify.com.br", "pay.cakto.com.br", "pay.kirvano.com", "sun.eduzz.com", "app.monetizze.com.br", "pay.lowfy.io", "ev.braip.com", "pay.ticto.com.br", "pay.greenn.com.br", "checkout.perfectpay.com.br", "checkout.stripe.com", "checkout.loja.example"]) {
    assert.equal(matchesCheckoutUrl(`https://${host}/offer/payment?utm_source=meta`, `${host}/offer/`), true, host);
  }
});

test("normalization handles HTTPS defaults, host case, trailing slashes, and supported relative URLs", () => {
  assert.equal(normalizeCheckoutUrl(" PAY.WIAPY.COM/offer/ ")?.href, "https://pay.wiapy.com/offer");
  assert.equal(normalizeCheckoutUrl("/offer/", "https://pay.wiapy.com")?.href, "https://pay.wiapy.com/offer");
  assert.equal(normalizeCheckoutUrl("pay.wiapy.com:8443/offer/")?.href, "https://pay.wiapy.com:8443/offer");
  assert.equal(matchesCheckoutUrl("https://PAY.WIAPY.COM./offer/child", "https://pay.wiapy.com/offer/"), true);
  assert.equal(matchesCheckoutUrl("https://pay.wiapy.com/anything", "https://pay.wiapy.com/"), true);
  assert.equal(matchesCheckoutUrl("https://pay.wiapy.com/Offer", "https://pay.wiapy.com/offer"), false);
});

test("host comparison rejects lookalikes, implicit subdomains and a valid domain inside query or credentials", () => {
  const rule = "https://pay.wiapy.com/";
  for (const target of ["https://evil-wiapy.com/", "https://pay.wiapy.com.evil.com/", "https://child.pay.wiapy.com/", "https://evil.com/?redirect=https://pay.wiapy.com/", "https://pay.wiapy.com@evil.com/", "https://user:password@pay.wiapy.com/"]) {
    assert.equal(matchesCheckoutUrl(target, rule), false, target);
  }
  assert.equal(matchesCheckoutUrl("https://child.pay.wiapy.com/", "https://child.pay.wiapy.com/"), true);
});

test("only HTTP(S) is accepted and HTTPS rules reject downgrade or alternate ports", () => {
  for (const target of ["javascript:alert(1)", "data:text/html,pay.wiapy.com", "ftp://pay.wiapy.com/", "#checkout", "", "https://pay.wiapy.com\\@evil.com/"]) {
    assert.equal(normalizeCheckoutUrl(target), null, target);
  }
  assert.equal(matchesCheckoutUrl("http://pay.wiapy.com/", "https://pay.wiapy.com/"), false);
  assert.equal(matchesCheckoutUrl("https://pay.wiapy.com/", "http://pay.wiapy.com/"), true);
  assert.equal(matchesCheckoutUrl("https://pay.wiapy.com:8443/", "https://pay.wiapy.com/"), false);
  assert.equal(matchesCheckoutUrl("https://pay.wiapy.com:443/", "pay.wiapy.com"), true);
});

test("specific paths only accept exact path or descendants with a segment boundary", () => {
  const rule = "https://pay.wiapy.com/product/abc";
  assert.equal(matchesCheckoutUrl(`${rule}/`, rule), true);
  assert.equal(matchesCheckoutUrl(`${rule}/payment`, rule), true);
  for (const target of ["https://pay.wiapy.com/product/abcd", "https://pay.wiapy.com/product/other", "https://pay.wiapy.com/product/abc/../other", "https://pay.wiapy.com/product/abc%2Fother", "https://pay.wiapy.com/product/abc%5Cother"]) {
    assert.equal(matchesCheckoutUrl(target, rule), false, target);
  }
});

test("tracking query parameters are ignored while configured business parameters are enforced", () => {
  const rule = "https://pay.hotmart.com/P123?off=A&utm_source=old&sck=old";
  assert.equal(matchesCheckoutUrl("https://pay.hotmart.com/P123?off=A&utm_source=meta&utm_campaign=test&fbclid=click&fbc=click&fbp=browser&sck=session&xcod=session&src=session&coupon=SAVE", rule), true);
  assert.equal(matchesCheckoutUrl("https://pay.hotmart.com/P123?off=B&utm_source=old&sck=old", rule), false);
  assert.equal(matchesCheckoutUrl("https://pay.hotmart.com/P123?utm_source=meta", rule), false);
  assert.equal(matchesCheckoutUrl("https://pay.hotmart.com/P123?off=A&off=B", rule), false);
});

test("workspace matching returns the exact compatible offer and never resolves ambiguity by order", () => {
  const offers = [
    { id: "wiapy", checkout_url: "https://pay.wiapy.com/product/a" },
    { id: "hotmart-a", checkout_url: "https://pay.hotmart.com/P123?off=A" },
    { id: "hotmart-b", checkout_url: "https://pay.hotmart.com/P123?off=B" },
    { id: "unconfigured", checkout_url: null },
  ];
  assert.deepEqual(matchingCheckoutOffers("https://pay.wiapy.com/product/a?utm_sck=visitor", offers).map((offer) => offer.id), ["wiapy"]);
  assert.deepEqual(matchingCheckoutOffers("https://pay.hotmart.com/P123?off=B&sck=visitor", offers).map((offer) => offer.id), ["hotmart-b"]);
  assert.deepEqual(matchingCheckoutOffers("https://pay.wiapy.com/product/b", offers), []);
  const ambiguous = [...offers, { id: "overlap", checkout_url: "https://pay.wiapy.com/" }];
  assert.equal(matchingCheckoutOffers("https://pay.wiapy.com/product/a", ambiguous).length, 2);
});

test("public tracker can instantiate exactly the server matcher without imports or evaluation dependencies", () => {
  const browserMatcher = runInNewContext(`(${createCheckoutUrlMatcher.toString()})()`, { URL, URLSearchParams }) as ReturnType<typeof createCheckoutUrlMatcher>;
  assert.equal(browserMatcher.matchesCheckoutUrl("https://pay.wiapy.com/a?utm_source=meta", "pay.wiapy.com/"), true);
  assert.equal(browserMatcher.matchesCheckoutUrl("https://evil.com/?checkout=pay.wiapy.com", "pay.wiapy.com/"), false);
});
