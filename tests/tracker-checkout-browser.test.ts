import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { createCheckoutUrlMatcher } from "../src/lib/tracker";

const trackerSource = readFileSync("public/tracker.js", "utf8");
const landingUrl = "https://landing.example/oferta?utm_source=facebook&utm_campaign=campaign-1&utm_content=creative-1";
const trackingKey = "public-test-key";
type BrowserEvent = { event_type: string; event_id: string; session_id: string; url: string; attribution: Record<string, string> };
type Listener = (event: Record<string, unknown>) => void;

class Element {
  readonly tagName: string;
  readonly nodeType = 1;
  readonly attributes = new Map<string, string>();
  readonly children: Element[] = [];
  parentElement: Element | null = null;
  innerText = "";
  textContent = "";
  className = "";
  type = "";
  name = "";
  value = "";
  disabled = false;
  checked = true;
  onload?: () => void;
  onerror?: () => void;
  private readonly listeners = new Map<string, Listener[]>();

  constructor(tag: string, attributes: Record<string, string> = {}) {
    this.tagName = tag.toUpperCase();
    for (const [name, value] of Object.entries(attributes)) this.setAttribute(name, value);
  }

  setAttribute(name: string, value: string) { this.attributes.set(name, String(value)); }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  hasAttribute(name: string) { return this.attributes.has(name); }
  get href() { return new URL(this.getAttribute("href") || landingUrl, landingUrl).href; }
  set href(value: string) { this.setAttribute("href", value); }
  get action() { return new URL(this.getAttribute("action") || landingUrl, landingUrl).href; }
  set action(value: string) { this.setAttribute("action", value); }
  get src() { return this.getAttribute("src") || ""; }
  set src(value: string) { this.setAttribute("src", value); }
  get elements() { return this.querySelectorAll("input,button,select,textarea"); }
  appendChild(child: Element) { child.parentElement = this; this.children.push(child); return child; }
  addEventListener(name: string, listener: Listener) { this.listeners.set(name, [...(this.listeners.get(name) || []), listener]); }
  emit(name: string) { for (const listener of this.listeners.get(name) || []) listener({ target: this }); }
  matches(selector: string): boolean {
    return selector.split(",").some((part) => {
      const rule = part.trim();
      const tag = rule.match(/^[a-z]+/i)?.[0];
      if (tag && this.tagName !== tag.toUpperCase()) return false;
      const attributes = [...rule.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)];
      return attributes.every(([, name, expected]) => {
        const actual = this.getAttribute(name) ?? (name === "name" ? this.name : null);
        return actual !== null && (expected === undefined || actual === expected);
      });
    });
  }
  closest(selector: string): Element | null { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
  querySelectorAll(selector: string): Element[] {
    return this.children.flatMap((child) => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector: string) { return this.querySelectorAll(selector)[0] || null; }
}

function browser(rules: string[] = ["https://pay.wiapy.com/"], loadConfig = true, options: { blockedOpen?: boolean; historyThrows?: boolean } = {}) {
  const requests: BrowserEvent[] = [];
  const pixelCalls: unknown[][] = [];
  const opened: string[] = [];
  const historyDestinations: string[] = [];
  const timers: Array<() => void> = [];
  const listeners = new Map<string, Listener[]>();
  const windowListeners = new Map<string, Listener[]>();
  const observed = new Set<Element>();
  const intersections: Array<(entries: Array<{ target: Element; isIntersecting: boolean }>) => void> = [];
  const mutations: Array<(records: Array<{ addedNodes: Element[]; type: string; target: Element }>) => void> = [];
  const script = new Element("script", { "data-key": trackingKey, src: "https://trackbase.example/tracker.js" });
  const head = new Element("head");
  const body = new Element("body");
  const root = new Element("html");
  root.appendChild(head);
  root.appendChild(body);
  const storage = () => {
    const values = new Map<string, string>();
    return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, String(value)); }, removeItem: (key: string) => { values.delete(key); } };
  };
  const document = {
    currentScript: script, readyState: "complete", cookie: "", head, body, documentElement: root,
    createElement: (tag: string) => new Element(tag),
    querySelector: (selector: string) => selector === "script[data-key]" ? script : root.querySelector(selector),
    querySelectorAll: (selector: string) => root.querySelectorAll(selector),
    addEventListener: (name: string, listener: Listener) => { listeners.set(name, [...(listeners.get(name) || []), listener]); },
  };
  const window = {
    location: new URL(landingUrl), innerHeight: 700, pageYOffset: 0,
    __TRACKBASE_CHECKOUT_CONFIG__: {} as Record<string, { rules: string[]; matches: ReturnType<typeof createCheckoutUrlMatcher>["matchesCheckoutUrl"] }>,
    addEventListener: (name: string, listener: Listener) => { windowListeners.set(name, [...(windowListeners.get(name) || []), listener]); },
    fbq: (...args: unknown[]) => { pixelCalls.push(args); },
    open: (destination: string) => { opened.push(destination); return options.blockedOpen ? null : {}; },
    requestAnimationFrame: (callback: () => void) => { timers.push(callback); },
  };
  class IntersectionObserverMock {
    constructor(callback: (entries: Array<{ target: Element; isIntersecting: boolean }>) => void) { intersections.push(callback); }
    observe(element: Element) { observed.add(element); }
    disconnect() { observed.clear(); }
    unobserve(element: Element) { observed.delete(element); }
  }
  class MutationObserverMock {
    constructor(callback: (records: Array<{ addedNodes: Element[]; type: string; target: Element }>) => void) { mutations.push(callback); }
    observe() {}
    disconnect() {}
  }
  const navigateHistory = (_state: unknown, _unused: string, destination?: string | URL | null) => {
    if (options.historyThrows) throw new Error("History navigation rejected");
    if (destination) {
      const target = new URL(String(destination), window.location.href);
      if (target.origin !== window.location.origin) throw new Error("Cross-origin history is forbidden");
      historyDestinations.push(target.href);
      window.location = target;
    }
  };
  const history = { pushState: navigateHistory, replaceState: navigateHistory };
  const context = {
    window, document, location: window.location, history, URL, URLSearchParams, Blob,
    localStorage: storage(), sessionStorage: storage(), navigator: { sendBeacon: () => false },
    IntersectionObserver: IntersectionObserverMock, MutationObserver: MutationObserverMock,
    HTMLElement: Element, HTMLFormElement: Element,
    setTimeout: (callback: () => void) => { timers.push(callback); return timers.length; },
    clearTimeout() {},
    fetch: (_url: string, options?: { method?: string; body?: string }) => {
      if (options?.method === "POST" && options.body) requests.push(JSON.parse(options.body) as BrowserEvent);
      return Promise.resolve({ ok: true });
    },
  };
  vm.runInNewContext(trackerSource, context, { filename: "public/tracker.js" });
  const flushTimers = () => { for (let limit = 30; timers.length && limit > 0; limit--) timers.shift()?.(); };
  const configuration = () => {
    const configScripts = head.querySelectorAll("script");
    assert.equal(configScripts.length, 1, "tracker requests its public checkout configuration once");
    const configUrl = new URL(configScripts[0].src);
    assert.equal(configUrl.origin, "https://trackbase.example");
    assert.equal(configUrl.pathname, "/api/track");
    assert.equal(configUrl.searchParams.get("key"), trackingKey);
    assert.equal(configUrl.searchParams.get("format"), "js");
    window.__TRACKBASE_CHECKOUT_CONFIG__[trackingKey] = { rules, matches: createCheckoutUrlMatcher().matchesCheckoutUrl };
    configScripts[0].onload?.();
    configScripts[0].emit("load");
    flushTimers();
  };
  if (loadConfig) configuration();
  const append = (element: Element) => {
    body.appendChild(element);
    for (const mutation of mutations) mutation([{ type: "childList", addedNodes: [element], target: body }]);
    flushTimers();
    return element;
  };
  const dispatch = (name: string, target: Element, extra: Record<string, unknown> = {}) => {
    for (const listener of listeners.get(name) || []) listener({ target, button: 0, isTrusted: true, defaultPrevented: false, ...extra });
  };
  return {
    requests, pixelCalls, opened, window, history, historyDestinations, observed, append, configuration,
    checkoutEvents: () => requests.filter((event) => event.event_type === "checkout"),
    pixelCheckouts: () => pixelCalls.filter((call) => call[0] === "track" && call[1] === "InitiateCheckout"),
    click: (element: Element) => dispatch("click", element),
    submit: (element: Element, submitter?: Element) => dispatch("submit", element, { submitter }),
    visible: (element: Element) => { for (const callback of intersections) callback([{ target: element, isIntersecting: true }]); },
  };
}

test("configured Wiapy link emits checkout with the decorated destination and the Pixel event ID", () => {
  const page = browser();
  const link = page.append(new Element("a", { href: "https://pay.wiapy.com/product-1?coupon=SAVE" }));
  page.click(link);
  const [checkout] = page.checkoutEvents();
  assert.equal(page.checkoutEvents().length, 1);
  assert.equal(page.pixelCheckouts().length, 1);
  const destination = new URL(checkout.url);
  assert.equal(destination.hostname, "pay.wiapy.com");
  assert.equal(destination.searchParams.get("coupon"), "SAVE");
  assert.equal(destination.searchParams.get("utm_campaign"), "campaign-1");
  assert.equal(destination.searchParams.get("sck"), checkout.session_id);
  assert.equal(new URL(link.href).searchParams.get("sck"), checkout.session_id);
  assert.equal((page.pixelCheckouts()[0][3] as { eventID: string }).eventID, checkout.event_id);
});

test("generic purchase button stays a CTA click and never emits browser InitiateCheckout", () => {
  const page = browser();
  const button = page.append(new Element("button"));
  button.innerText = "Comprar agora e garantir minha vaga";
  page.click(button);
  assert.equal(page.checkoutEvents().length, 0);
  assert.equal(page.pixelCheckouts().length, 0);
  assert.equal(page.requests.filter((event) => event.event_type === "cta_click").length, 1);
});

test("explicit data-trackbase-checkout requires a configured destination", () => {
  const page = browser();
  page.click(page.append(new Element("button", { "data-trackbase-checkout": "https://pay.wiapy.com/product-1" })));
  page.click(page.append(new Element("button", { "data-trackbase-checkout": "https://pay.hotmart.com/unconfigured" })));
  assert.equal(page.checkoutEvents().length, 1);
  assert.equal(page.pixelCheckouts().length, 1);
  assert.equal(new URL(page.checkoutEvents()[0].url).hostname, "pay.wiapy.com");
});

test("known gateway, deceptive host and incompatible path cannot become checkout without matching the offer", () => {
  const page = browser(["https://pay.wiapy.com/product-1/"]);
  for (const href of [
    "https://pay.hotmart.com/unconfigured",
    "https://evil-wiapy.com/product-1",
    "https://pay.wiapy.com.evil.com/product-1",
    "https://evil.com/?redirect=https://pay.wiapy.com/product-1/",
    "https://pay.wiapy.com/product-10",
  ]) page.click(page.append(new Element("a", { href })));
  assert.equal(page.checkoutEvents().length, 0);
  assert.equal(page.pixelCheckouts().length, 0);
});

test("checkout form decorates its real action and carries attribution into submitted fields", () => {
  const page = browser();
  const form = page.append(new Element("form", { action: "https://pay.wiapy.com/product-1", method: "get" }));
  page.submit(form);
  assert.equal(page.checkoutEvents().length, 1);
  assert.equal(page.pixelCheckouts().length, 1);
  const checkout = page.checkoutEvents()[0];
  assert.equal(new URL(form.action).searchParams.get("sck"), checkout.session_id);
  assert.equal(form.querySelector('input[name="sck"]')?.value, checkout.session_id);
  assert.equal(form.querySelector('input[name="utm_campaign"]')?.value, "campaign-1");
  page.submit(page.append(new Element("form", { action: "https://landing.example/contact" })));
  assert.equal(page.checkoutEvents().length, 1);
});

test("separate configured offers match their respective paths while ambiguous destinations fail closed", () => {
  const page = browser(["https://pay.wiapy.com/first", "https://pay.wiapy.com/second"]);
  page.click(page.append(new Element("a", { href: "https://pay.wiapy.com/first" })));
  page.click(page.append(new Element("a", { href: "https://pay.wiapy.com/second/step" })));
  assert.equal(page.checkoutEvents().length, 2);
  const ambiguous = browser(["https://pay.wiapy.com/", "https://pay.wiapy.com/first"]);
  ambiguous.click(ambiguous.append(new Element("a", { href: "https://pay.wiapy.com/first" })));
  assert.equal(ambiguous.checkoutEvents().length, 0);
  assert.equal(ambiguous.pixelCheckouts().length, 0);
});

test("dynamic configured CTA visibility remains separate from a real checkout click", () => {
  const page = browser();
  const link = page.append(new Element("a", { href: "https://pay.wiapy.com/product-1" }));
  assert.ok(page.observed.has(link), "dynamically inserted checkout becomes observable");
  page.visible(link);
  assert.equal(page.requests.filter((event) => event.event_type === "cta_view").length, 1);
  assert.equal(page.checkoutEvents().length, 0);
  assert.equal(page.pixelCheckouts().length, 0);
  page.click(link);
  assert.equal(page.checkoutEvents().length, 1);
});

test("detectable programmatic window.open decorates configured checkout only", () => {
  const page = browser();
  page.window.open("https://pay.wiapy.com/product-1");
  page.window.open("https://pay.hotmart.com/unconfigured");
  assert.equal(page.checkoutEvents().length, 1);
  assert.equal(page.pixelCheckouts().length, 1);
  assert.equal(new URL(page.opened[0]).searchParams.get("sck"), page.checkoutEvents()[0].session_id);
});

test("missing checkout configuration keeps PageView working and fails closed for checkout and Pixel", () => {
  const page = browser([], false);
  const link = page.append(new Element("a", { href: "https://pay.wiapy.com/product-1" }));
  page.click(link);
  assert.equal(page.requests.filter((event) => event.event_type === "pageview").length, 1);
  assert.equal(page.checkoutEvents().length, 0);
  assert.equal(page.pixelCheckouts().length, 0);
});

test("form submitter formaction determines the checkout destination", () => {
  const page = browser();
  const form = page.append(new Element("form", { action: "https://pay.wiapy.com/product-1" }));
  const unconfiguredSubmitter = form.appendChild(new Element("button", { formaction: "https://landing.example/contact" }));
  page.submit(form, unconfiguredSubmitter);
  assert.equal(page.checkoutEvents().length, 0);
  const configuredSubmitter = form.appendChild(new Element("button", { formaction: "https://pay.wiapy.com/product-2" }));
  page.submit(form, configuredSubmitter);
  assert.equal(page.checkoutEvents().length, 1);
  assert.equal(new URL(page.checkoutEvents()[0].url).pathname, "/product-2");
  assert.equal(new URL(configuredSubmitter.getAttribute("formaction")!).searchParams.get("sck"), page.checkoutEvents()[0].session_id);
});

test("GET form controls overriding a configured product query cannot produce an IC for another product", () => {
  const page = browser(["https://pay.wiapy.com/checkout?plan=one"]);
  const form = page.append(new Element("form", { action: "https://pay.wiapy.com/checkout?plan=one", method: "get" }));
  const product = form.appendChild(new Element("input"));
  product.name = "plan";
  product.value = "two";
  product.type = "hidden";
  page.submit(form);
  assert.equal(page.checkoutEvents().length, 0);
  assert.equal(page.pixelCheckouts().length, 0);
  assert.equal(page.requests.filter((event) => event.event_type === "cta_click").length, 1);
});

test("blocked programmatic popup does not count as checkout", () => {
  const page = browser(["https://pay.wiapy.com/"], true, { blockedOpen: true });
  assert.equal(page.window.open("https://pay.wiapy.com/product-1"), null);
  assert.equal(page.checkoutEvents().length, 0);
  assert.equal(page.pixelCheckouts().length, 0);
});

test("successful same-origin history navigation records the configured checkout", () => {
  const page = browser(["https://landing.example/checkout"]);
  page.history.pushState({}, "", "/checkout");
  assert.equal(page.checkoutEvents().length, 1);
  assert.equal(page.pixelCheckouts().length, 1);
  assert.equal(new URL(page.historyDestinations[0]).searchParams.get("sck"), page.checkoutEvents()[0].session_id);
});

test("failed history navigation cannot emit checkout", () => {
  const page = browser(["https://landing.example/checkout"], true, { historyThrows: true });
  assert.throws(() => page.history.replaceState({}, "", "/checkout"), /rejected/);
  assert.equal(page.checkoutEvents().length, 0);
  assert.equal(page.pixelCheckouts().length, 0);
});
