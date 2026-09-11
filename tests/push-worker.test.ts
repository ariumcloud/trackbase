import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { MessageChannel } from "node:worker_threads";

type PushEvent = { data: { json: () => { id: string; title: string } }; waitUntil: (value: Promise<void>) => void };
type MessageEvent = { data: unknown; source: { id: string } | null };

// Simulates the page -> worker focus channel: WebKit doesn't reliably report
// WindowClient.focused/visibilityState inside the service worker, so the real
// worker trusts only messages the page itself sent about its own focus state.
function runPush(clientIds: string[], focusedIds: string[]) {
  const listeners = new Map<string, (event: PushEvent | MessageEvent) => void>();
  const shown: Array<{ title: string; options: unknown }> = [];
  const messagesSent: Array<{ type: string }> = [];
  const windowClients = clientIds.map((id) => ({
    id,
    url: "https://trackbase.com.br/painel",
    postMessage(message: { type: string }) {
      messagesSent.push(message);
    },
  }));
  const self = {
    location: { href: "https://trackbase.com.br/sw.js" },
    addEventListener(type: string, handler: (event: PushEvent | MessageEvent) => void) { listeners.set(type, handler); },
    skipWaiting: () => Promise.resolve(),
    clients: {
      claim: () => Promise.resolve(),
      matchAll: async () => windowClients,
      openWindow: async () => undefined,
    },
    registration: { showNotification: async (title: string, options: unknown) => { shown.push({ title, options }); } },
  };
  const context = vm.createContext({
    self, URL, MessageChannel, Promise, console, crypto: { randomUUID: () => "push-1" },
    setTimeout, clearTimeout,
  });
  vm.runInContext(readFileSync("public/sw.js", "utf8"), context);

  for (const client of windowClients) {
    listeners.get("message")!({ data: { type: "APP_FOCUS_STATE", focused: focusedIds.includes(client.id) }, source: client });
  }

  let pending: Promise<void> | undefined;
  (listeners.get("push")! as (event: PushEvent) => void)({
    data: { json: () => ({ id: "push-1", title: "Venda Realizada" }) },
    waitUntil: (value: Promise<void>) => { pending = value; },
  });
  return { pending: pending!, shown, messagesSent };
}

test("a tab that told the worker it's focused gets only the custom sound — the OS banner would just play its own sound over it", async () => {
  const { pending, shown, messagesSent } = runPush(["window-0"], ["window-0"]);
  await pending;
  assert.equal(shown.length, 0);
  assert.equal(messagesSent.length, 1);
  assert.equal(messagesSent[0].type, "PLAY_SALE_SOUND");
});

test("no tab reporting itself focused falls back to the OS notification, since nobody is looking at the app", async () => {
  for (const [clientIds, focusedIds] of [[[], []], [["window-0"], []], [["window-0", "window-1"], []]] as const) {
    const { pending, shown, messagesSent } = runPush([...clientIds], [...focusedIds]);
    await pending;
    assert.equal(shown.length, 1, JSON.stringify(clientIds));
    assert.equal(shown[0].title, "Venda Realizada");
    assert.equal(messagesSent.length, clientIds.length);
  }
});

test("a stale focused flag from a tab that has since closed is ignored — only currently open clients count", async () => {
  // window-0 reported focused once, but is no longer in the current client list.
  const { pending, shown, messagesSent } = runPush(["window-1"], ["window-0"]);
  await pending;
  assert.equal(shown.length, 1);
  assert.equal(messagesSent.length, 1);
});
