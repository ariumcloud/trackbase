// Service Worker para Push Notifications (Estilo Utmfy / Trackbase)
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const title = payload.title || "💰 Venda Realizada!";
    const options = {
      body: payload.body || "Nova compra aprovada na sua operação.",
      icon: "/trackbase-icon-192-v3.png",
      badge: "/Logo Roxa 42x42 PNG favicon.png",
      vibrate: [200, 100, 200, 100, 400],
      tag: payload.tag || `sale-${Date.now()}`,
      data: {
        url: payload.url || "/painel",
      },
      actions: [
        { action: "open", title: "Ver no Painel" },
        { action: "close", title: "Dispensar" },
      ],
      renotify: true,
      requireInteraction: false,
    };

    // In the foreground, avoid showNotification entirely: iOS would play its
    // generic system sound even while the Trackbase screen is open. The page
    // receives this message and plays the user-unlocked custom sound instead.
    const deliver = self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const visibleClients = clientList.filter((client) => client.visibilityState === "visible");
      if (visibleClients.length) {
        visibleClients.forEach((client) => client.postMessage({
          type: "PLAY_SALE_SOUND",
          data: payload,
        }));
        return;
      }
      return self.registration.showNotification(title, options);
    });

    event.waitUntil(deliver);
  } catch (err) {
    console.error("Erro ao processar push notification:", err);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawUrl = event.notification.data?.url || "/painel";
  const separator = rawUrl.includes("?") ? "&" : "?";
  const urlToOpen = `${rawUrl}${separator}sale_alert=1`;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes("/painel") && "focus" in client) {
          client.postMessage({
            type: "PLAY_SALE_SOUND",
            data: event.notification.data,
          });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
