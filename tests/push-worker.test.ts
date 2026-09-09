import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { MessageChannel } from "node:worker_threads";

test("worker silences only after an explicit audio-started ACK", async () => {
  const listeners = new Map<string, (event: any) => void>();
  const shown: Array<{ title: string; options: { silent: boolean } }> = [];
  let ack: "started" | "blocked" = "started";
  const client = {
    id: "window-1",
    url: "https://trackbase.com.br/painel",
    visibilityState: "visible",
    focused: true,
    postMessage(message: any, ports: any[]) {
      ports[0].postMessage({ id: message.id, version: message.version, status: ack });
    },
  };
  const self = {
    location: { href: "https://trackbase.com.br/sw.js" },
    addEventListener(type: string, handler: (event: any) => void) { listeners.set(type, handler); },
    skipWaiting: () => Promise.resolve(),
    clients: {
      claim: () => Promise.resolve(),
      matchAll: async () => [client],
      openWindow: async () => undefined,
    },
    registration: { showNotification: async (title: string, options: any) => { shown.push({ title, options }); } },
  };
  const context = vm.createContext({
    self, URL, MessageChannel, Promise, console, crypto: { randomUUID: () => "push-1" },
    setTimeout, clearTimeout,
  });
  vm.runInContext(readFileSync("public/sw.js", "utf8"), context);

  let pending: Promise<void> | undefined;
  listeners.get("push")!({ data: { json: () => ({ id: "push-1", title: "Venda" }) }, waitUntil: (value: Promise<void>) => { pending = value; } });
  await pending;
  assert.equal(shown[0].options.silent, true);

  ack = "blocked";
  listeners.get("push")!({ data: { json: () => ({ id: "push-2", title: "Venda 2" }) }, waitUntil: (value: Promise<void>) => { pending = value; } });
  await pending;
  assert.equal(shown[1].options.silent, false);
});
