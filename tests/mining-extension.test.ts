import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { webcrypto } from "node:crypto";

test("extension worker confines credentials, validates senders and binds requests to approved workspace", async () => {
  const values: Record<string, unknown> = {};
  let listener: (
    message: unknown,
    sender: unknown,
    respond: (r: { data?: unknown; error?: string }) => void,
  ) => void = () => {};
  let fetchCount = 0;
  const extensionId = "a".repeat(32),
    token = "b".repeat(64),
    workspace = "00000000-0000-4000-8000-000000000001";
  const popup = {
    id: extensionId,
    url: `chrome-extension://${extensionId}/popup.html`,
  };
  const meta = {
    id: extensionId,
    url: "https://www.facebook.com/ads/library/?id=123456789",
  };
  const context = {
    URL,
    Date,
    TextEncoder,
    Uint8Array,
    crypto: webcrypto,
    AbortSignal,
    chrome: {
      storage: {
        session: {
          setAccessLevel: async (v: { accessLevel: string }) =>
            assert.equal(v.accessLevel, "TRUSTED_CONTEXTS"),
          get: async () => values,
          set: async (v: object) => Object.assign(values, v),
          remove: async (k: string) => {
            delete values[k];
          },
          clear: async () => {
            for (const k of Object.keys(values)) delete values[k];
          },
        },
      },
      permissions: { contains: async () => true },
      tabs: { create: async () => {} },
      runtime: {
        id: extensionId,
        getURL: (v: string) => `chrome-extension://${extensionId}/${v}`,
        onMessage: {
          addListener: (f: typeof listener) => {
            listener = f;
          },
        },
      },
    },
    fetch: async (url: string, init: RequestInit) => {
      fetchCount++;
      assert.equal(init.credentials, "omit");
      assert.equal(init.redirect, "error");
      if (url.endsWith("/extension"))
        return {
          ok: true,
          json: async () => ({
            token,
            workspace_id: workspace,
            workspace_name: "Teste",
            expires_at: new Date(Date.now() + 100000).toISOString(),
          }),
        };
      assert.equal(
        (init.headers as Record<string, string>).Authorization,
        `Bearer ${token}`,
      );
      assert.equal(JSON.parse(String(init.body)).workspace, workspace);
      return { ok: true, json: async () => ({ duplicate: true }) };
    },
  };
  runInNewContext(readFileSync("extension/background.js", "utf8"), context);
  const send = (message: unknown, sender = popup) =>
    new Promise<{ data?: unknown; error?: string }>((r) =>
      listener(message, sender, r),
    );
  assert.ok((await send({ action: "capture", capture: {} }, meta)).error);
  assert.ok(
    (
      await send(
        { action: "start", origin: "https://evil.example" },
        { ...popup, id: "other" },
      )
    ).error,
  );
  assert.ok(
    (await send({ action: "start", origin: "https://evil.example" }, meta))
      .error,
  );
  assert.equal(
    (await send({ action: "start", origin: "https://app.trackbase.com.br" }))
      .error,
    undefined,
  );
  const pending = values.pending as { verifier: string; challenge: string };
  assert.equal(pending.verifier.length, 64);
  assert.notEqual(pending.verifier, pending.challenge);
  assert.equal((await send({ action: "complete" })).error, undefined);
  const status = JSON.stringify(await send({ action: "status" }));
  assert.equal(status.includes(token), false);
  assert.equal(status.includes(pending.verifier), false);
  assert.ok((await send({ action: "status" }, meta)).error);
  assert.equal(
    (await send({ action: "capture", capture: {} }, meta)).error,
    undefined,
  );
  assert.equal(fetchCount, 2);
  assert.ok((await send({ action: "select", workspace: "foreign" })).error);
  await send({ action: "start", origin: "https://other.trackbase.com.br" });
  assert.equal(Object.keys(values.grants as object).length, 0);
});

test("MV3 references valid scripts with no mandatory broad hosts or remote execution", () => {
  const manifest = JSON.parse(readFileSync("extension/manifest.json", "utf8"));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["storage"]);
  assert.equal(manifest.host_permissions, undefined);
  for (const file of [
    manifest.background.service_worker,
    manifest.action.default_popup,
    ...manifest.content_scripts.flatMap(
      (c: { js: string[]; css: string[] }) => [...c.js, ...c.css],
    ),
  ])
    assert.ok(existsSync(`extension/${file}`));
  for (const file of ["background.js", "content.js", "parser.js", "popup.js"]) {
    const source = readFileSync(`extension/${file}`, "utf8");
    assert.equal(/innerHTML|eval\(|new Function\(/.test(source), false);
    assert.equal(
      /SUPABASE_SERVICE_ROLE|META_APP_SECRET|OPENAI_API_KEY/.test(source),
      false,
    );
  }
});
test("dynamic content inserts one action per card, handles recycled cards, loading and duplicates", async () => {
  class Element {
    dataset: Record<string, string> = {};
    children: Element[] = [];
    textContent = "";
    type = "";
    disabled = false;
    click?: (e: {
      preventDefault: () => void;
      stopPropagation: () => void;
    }) => Promise<void>;
    parent?: Element;
    innerText = "ID da biblioteca: 123456789";
    append(...children: Element[]) {
      for (const c of children) {
        c.parent = this;
        this.children.push(c);
      }
    }
    querySelector() {
      return this.children.find((c) => c.dataset.trackbaseControls);
    }
    remove() {
      if (this.parent)
        this.parent.children = this.parent.children.filter((c) => c !== this);
    }
    setAttribute() {}
    addEventListener(_name: string, callback: Element["click"]) {
      this.click = callback;
    }
  }
  const cards = [new Element()];
  let mutation: () => void = () => {};
  let queued: () => void = () => {};
  let duplicate = false;
  const context = {
    document: { body: {}, createElement: () => new Element() },
    TrackbaseParser: {
      cards: () => cards,
      idFromText: (text: string) => text.match(/\d+/)?.[0],
      capture: () => ({ library_id: "123456789" }),
    },
    MutationObserver: class {
      constructor(callback: () => void) {
        mutation = callback;
      }
      observe() {}
    },
    setTimeout: (callback: () => void) => {
      queued = callback;
      return 1;
    },
    clearTimeout: () => {},
    chrome: { runtime: { sendMessage: async () => ({ data: { duplicate } }) } },
  };
  runInNewContext(readFileSync("extension/content.js", "utf8"), context);
  assert.equal(cards[0].children.length, 1);
  mutation();
  queued();
  assert.equal(cards[0].children.length, 1);
  cards.push(new Element());
  mutation();
  queued();
  assert.equal(cards[1].children.length, 1);
  const controls = cards[0].children[0],
    button = controls.children[0],
    status = controls.children[2];
  const event = { preventDefault() {}, stopPropagation() {} };
  const pending = button.click!(event);
  assert.equal(button.disabled, true);
  await pending;
  assert.equal(button.disabled, false);
  assert.match(status.textContent, /Salvo/);
  duplicate = true;
  await button.click!(event);
  assert.match(status.textContent, /já salvo/);
  cards[0].innerText = "ID da biblioteca: 999999999";
  mutation();
  queued();
  assert.equal(cards[0].children.length, 1);
  assert.equal(cards[0].children[0].dataset.adId, "999999999");
});
