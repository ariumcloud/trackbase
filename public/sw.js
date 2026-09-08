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
      icon: "/trackbase-icon-192-v2.png",
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

    event.waitUntil(
      self.registration.showNotification(title, options).then(() => {
        // Com o painel aberto, a aba recebe a mensagem e toca o som localmente.
        return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
          clientList.forEach((client) => {
            client.postMessage({
              type: "PLAY_SALE_SOUND",
              data: payload,
            });
          });
        });
      })
    );
  } catch (err) {
    console.error("Erro ao processar push notification:", err);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || "/painel";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes("/painel") && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
