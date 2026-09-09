/* Bump when push delivery semantics change. */
const VERSION = "push-audio-20260909-1";
const DEBUG = new URL(self.location.href).searchParams.get("debug") === "1";
const trace = (stage, id, details = {}) => {
  if (DEBUG) console.info("[Trackbase push]", { stage, id, version: VERSION, ...details });
};

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("message", event => {
  if (event.data?.type === "TRACKBASE_PUSH_VERSION") {
    event.ports[0]?.postMessage({ version: VERSION });
  }
});

function requestSound(client, payload, id) {
  return new Promise(resolve => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => finish(false, "timeout"), 1000);
    let finished = false;
    function finish(started, status) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      channel.port1.close();
      trace("audio-result", id, { started, status });
      resolve(started);
    }
    channel.port1.onmessage = event => {
      if (event.data?.id !== id || event.data?.version !== VERSION) return;
      finish(event.data.status === "started", event.data.status);
    };
    try {
      const deadline = Date.now() + 750;
      client.postMessage({ type: "TRACKBASE_PUSH_SOUND", version: VERSION, id, deadline, payload, debug: DEBUG }, [channel.port2]);
      trace("postMessage-sent", id, { clientId: client.id });
    } catch {
      finish(false, "postMessage-failed");
    }
  });
}

self.addEventListener("push", event => {
  event.waitUntil((async () => {
    let payload = {};
    try { payload = event.data?.json() || {}; } catch { /* show a generic visual alert */ }
    const id = payload.id || payload.tag || crypto.randomUUID();
    trace("push-received", id);
    let started = false;
    try {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const visible = clients
        .filter(client => client.visibilityState === "visible" && new URL(client.url).pathname === "/painel")
        .sort((a, b) => Number(b.focused) - Number(a.focused));
      if (visible[0]) started = await requestSound(visible[0], payload, id);
      else trace("no-visible-client", id);
    } catch { trace("client-lookup-failed", id); }
    // Web Push requires a user-visible notification for every push.
    await self.registration.showNotification(payload.title || "💰 Venda Realizada!", {
      body: payload.body || "Nova compra aprovada na sua operação.",
      icon: "/trackbase-icon-192-v3.png",
      badge: "/Logo Roxa 42x42 PNG favicon.png",
      silent: started,
      tag: id,
      data: { url: payload.url || "/painel", id },
      actions: [
        { action: "open", title: "Ver no Painel" },
        { action: "close", title: "Dispensar" },
      ],
      renotify: true,
      requireInteraction: false,
    });
    trace("notification-shown", id, { silent: started });
  })());
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  if (event.action === "close") return;
  event.waitUntil((async () => {
    let url = new URL("/painel", self.location.origin);
    try {
      const candidate = new URL(event.notification.data?.url || "/painel", self.location.origin);
      if (candidate.origin === self.location.origin) url = candidate;
    } catch {}
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const client = clients.find(item => new URL(item.url).pathname === "/painel");
    if (client) {
      await client.navigate(url.href);
      await client.focus();
    } else if (self.clients.openWindow) {
      await self.clients.openWindow(url.href);
    }
  })());
});
