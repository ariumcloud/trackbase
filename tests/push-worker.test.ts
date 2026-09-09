import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { MessageChannel } from "node:worker_threads";

test("worker broadcasts PLAY_SALE_SOUND to clients and shows notification", async () => {
  const listeners = new Map<string, (event: any) => void>();
  const shown: Array<{ title: string; options: any }> = [];
  const messagesSent: any[] = [];
  const client = {
    id: "window-1",
    url: "https://trackbase.com.br/painel",
    visibilityState: "visible",
    focused: true,
    postMessage(message: any) {
      messagesSent.push(message);
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
  listeners.get("push")!({ data: { json: () => ({ id: "push-1", title: "Venda Realizada" }) }, waitUntil: (value: Promise<void>) => { pending = value; } });
  await pending;
  assert.equal(shown.length, 1);
  assert.equal(shown[0].title, "Venda Realizada");
  assert.equal(messagesSent.length, 1);
  assert.equal(messagesSent[0].type, "PLAY_SALE_SOUND");
});
