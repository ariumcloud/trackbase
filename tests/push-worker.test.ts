import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { MessageChannel } from "node:worker_threads";

type PushEvent = { data: { json: () => { id: string; title: string } }; waitUntil: (value: Promise<void>) => void };

function runPush(clients: Array<{ visibilityState: string; focused: boolean }>) {
  const listeners = new Map<string, (event: PushEvent) => void>();
  const shown: Array<{ title: string; options: unknown }> = [];
  const messagesSent: Array<{ type: string }> = [];
  const windowClients = clients.map((c, i) => ({
    id: `window-${i}`,
    url: "https://trackbase.com.br/painel",
    ...c,
    postMessage(message: { type: string }) {
      messagesSent.push(message);
    },
  }));
  const self = {
    location: { href: "https://trackbase.com.br/sw.js" },
    addEventListener(type: string, handler: (event: PushEvent) => void) { listeners.set(type, handler); },
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

  let pending: Promise<void> | undefined;
  listeners.get("push")!({ data: { json: () => ({ id: "push-1", title: "Venda Realizada" }) }, waitUntil: (value: Promise<void>) => { pending = value; } });
  return { pending: pending!, shown, messagesSent };
}

test("a focused, visible tab gets only the custom sound — the OS banner would just play its own sound over it", async () => {
  const { pending, shown, messagesSent } = runPush([{ visibilityState: "visible", focused: true }]);
  await pending;
  assert.equal(shown.length, 0);
  assert.equal(messagesSent.length, 1);
  assert.equal(messagesSent[0].type, "PLAY_SALE_SOUND");
});

test("no focused/visible tab falls back to the OS notification, since nobody is looking at the app", async () => {
  for (const clients of [[], [{ visibilityState: "hidden", focused: false }], [{ visibilityState: "visible", focused: false }]]) {
    const { pending, shown, messagesSent } = runPush(clients);
    await pending;
    assert.equal(shown.length, 1, JSON.stringify(clients));
    assert.equal(shown[0].title, "Venda Realizada");
    assert.equal(messagesSent.length, clients.length);
  }
});
