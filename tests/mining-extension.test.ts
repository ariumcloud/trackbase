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

test("popup UI renders brand identity, visual states, copy action and full guide", async () => {
  const popupHtml = readFileSync("extension/popup.html", "utf8");
  const popupCss = readFileSync("extension/popup.css", "utf8");

  // Visual Identity checks
  assert.ok(popupHtml.includes('class="brand-title">Trackbase'));
  assert.ok(popupHtml.includes("Capture ofertas da Biblioteca de Anúncios da Meta"));
  assert.ok(popupHtml.includes('id="btn-open-guide"'));
  assert.ok(popupHtml.includes('id="guide-view"'));
  assert.ok(popupHtml.includes('id="btn-copy-challenge"'));
  assert.ok(popupHtml.includes("Instalação no Google Chrome"));
  assert.ok(popupHtml.includes("Primeiro Vínculo com o Workspace"));
  assert.ok(popupHtml.includes("Uso na Biblioteca da Meta"));
  assert.ok(popupHtml.includes("Organização & Inteligência no Painel"));
  assert.ok(popupHtml.includes("Solução de Problemas (Troubleshooting)"));

  // CSS palette checks
  assert.ok(popupCss.includes("--brand: #5b34ea"));
  assert.ok(popupCss.includes("--green: #10b981"));
  assert.ok(popupCss.includes("--red: #ef3340"));
  assert.ok(popupCss.includes(".status-connected"));
  assert.ok(popupCss.includes(".status-pending"));
  assert.ok(popupCss.includes(".status-expired"));

  // Mock DOM for popup.js execution
  class MockElement {
    id = "";
    value = "";
    textContent = "";
    hidden = false;
    disabled = false;
    children: MockElement[] = [];
    classList = new (class {
      classes = new Set<string>();
      add(...c: string[]) {
        c.forEach((x) => this.classes.add(x));
      }
      remove(...c: string[]) {
        c.forEach((x) => this.classes.delete(x));
      }
      contains(x: string) {
        return this.classes.has(x);
      }
    })();
    onclick?: () => void;
    onchange?: () => void;
    append(child: MockElement) {
      this.children.push(child);
    }
    replaceChildren(...children: MockElement[]) {
      this.children = children;
    }
    trim() {
      return this.value.trim();
    }
  }

  const elements: Record<string, MockElement> = {
    origin: Object.assign(new MockElement(), { id: "origin", value: "https://trackbase.com.br" }),
    challenge: Object.assign(new MockElement(), { id: "challenge", value: "" }),
    workspace: Object.assign(new MockElement(), { id: "workspace" }),
    expiry: Object.assign(new MockElement(), { id: "expiry" }),
    message: Object.assign(new MockElement(), { id: "message" }),
    "message-container": Object.assign(new MockElement(), { id: "message-container" }),
    "status-card": Object.assign(new MockElement(), { id: "status-card" }),
    "status-badge": Object.assign(new MockElement(), { id: "status-badge" }),
    start: Object.assign(new MockElement(), { id: "start" }),
    complete: Object.assign(new MockElement(), { id: "complete" }),
    disconnect: Object.assign(new MockElement(), { id: "disconnect" }),
    "btn-copy-challenge": Object.assign(new MockElement(), { id: "btn-copy-challenge" }),
    "copy-text": Object.assign(new MockElement(), { id: "copy-text" }),
    "btn-open-guide": Object.assign(new MockElement(), { id: "btn-open-guide" }),
    "btn-close-guide": Object.assign(new MockElement(), { id: "btn-close-guide" }),
    "main-view": Object.assign(new MockElement(), { id: "main-view", hidden: false }),
    "guide-view": Object.assign(new MockElement(), { id: "guide-view", hidden: true }),
  };

  let copiedText = "";
  let sentMessages: unknown[] = [];
  const statusResponse = {
    origin: "https://app.trackbase.com.br",
    selected: "ws-1",
    pending: null,
    workspaces: [
      { id: "ws-1", name: "Workspace Alpha", expires_at: new Date(Date.now() + 36000000).toISOString() },
    ],
  };

  const context = {
    document: {
      getElementById: (id: string) => elements[id] || null,
      createElement: (tag: string) => Object.assign(new MockElement(), { tag }),
      querySelectorAll: () => [elements.start, elements.complete, elements.disconnect],
    },
    navigator: {
      clipboard: {
        writeText: async (t: string) => {
          copiedText = t;
        },
      },
    },
    chrome: {
      runtime: {
        sendMessage: async (msg: unknown) => {
          sentMessages.push(msg);
          return { data: statusResponse };
        },
      },
      permissions: {
        request: async () => true,
      },
    },
    URL,
    Date,
    setTimeout: (cb: () => void) => {
      cb();
      return 1;
    },
  };

  runInNewContext(readFileSync("extension/popup.js", "utf8"), context);

  // Wait for initial load()
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(elements.origin.value, "https://app.trackbase.com.br");
  assert.equal(elements["status-badge"].textContent, "Conectado: Workspace Alpha");
  assert.equal(elements.workspace.children.length, 1);
  assert.equal(elements.workspace.value, "ws-1");

  // Test guide navigation toggle
  elements["btn-open-guide"].onclick!();
  assert.equal(elements["main-view"].hidden, true);
  assert.equal(elements["guide-view"].hidden, false);

  elements["btn-close-guide"].onclick!();
  assert.equal(elements["main-view"].hidden, false);
  assert.equal(elements["guide-view"].hidden, true);

  // Test copy challenge
  elements.challenge.value = "test-challenge-hash-64-characters-long-example-code-1234567890abcdef";
  await elements["btn-copy-challenge"].onclick!();
  assert.equal(copiedText, "test-challenge-hash-64-characters-long-example-code-1234567890abcdef");

  // Test invalid origin validation
  elements.origin.value = "invalid-url";
  elements.start.onclick!();
  assert.equal(elements.message.textContent, "Endereço inválido.");
  assert.ok(elements["message-container"].classList.contains("is-error"));

  // Test valid start action
  elements.origin.value = "https://trackbase.com.br";
  elements.start.onclick!();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok(sentMessages.some((m) => (m as { action?: string })?.action === "start"));

  // Test complete action
  elements.complete.onclick!();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok(sentMessages.some((m) => (m as { action?: string })?.action === "complete"));

  // Test workspace select change
  elements.workspace.value = "ws-1";
  elements.workspace.onchange!();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok(sentMessages.some((m) => (m as { action?: string })?.action === "select"));

  // Test disconnect action
  elements.disconnect.onclick!();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok(sentMessages.some((m) => (m as { action?: string })?.action === "disconnect"));

  // Test ZIP package verification
  assert.ok(existsSync("public/downloads/trackbase-extension.zip"));
  const zipBuf = readFileSync("public/downloads/trackbase-extension.zip");
  assert.ok(zipBuf.length > 5000);
});


