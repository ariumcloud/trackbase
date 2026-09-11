// Service Worker para Push Notifications (Estilo Utmfy / Trackbase)
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// iOS Safari does not reliably report WindowClient.focused/visibilityState to
// the service worker (a known WebKit gap), so the client-id -> focused map
// below is fed only by the page itself, which broadcasts its real focus state
// on load, on visibilitychange and on focus/blur. A stale entry for a tab
// that has since closed is harmless: it's only ever read filtered against the
// current clients.matchAll() list, so a closed tab's id simply won't match.
const focusedClients = new Map();

self.addEventListener("message", (event) => {
  if (event.data?.type === "APP_FOCUS_STATE" && event.source) {
    focusedClients.set(event.source.id, Boolean(event.data.focused));
  }
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

    const notified = self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Notifica abas/janelas abertas IMEDIATAMENTE em paralelo (sem esperar showNotification)
      clientList.forEach((client) => {
        client.postMessage({
          type: "PLAY_SALE_SOUND",
          data: payload,
        });
      });

      // iOS/Safari sempre usa o alerta e o som padrão do sistema para uma
      // notificação disparada pelo Service Worker — não existe API que troque
      // esse som por um customizado. Quando o app já está aberto e em primeiro
      // plano, a própria página acabou de tocar o som real (acima); mostrar
      // TAMBÉM a notificação do sistema aqui só duplica o alerta com o som
      // errado por cima do correto. Só mostramos a notificação do SO quando
      // nenhuma aba em foco existe — ou seja, quando o usuário realmente não
      // está olhando para o app. O estado de foco vem do mapa alimentado pela
      // própria página (ver listener de "message" acima), não de
      // client.focused/visibilityState, que o WebKit não reporta direito.
      const hasFocusedClient = clientList.some((client) => focusedClients.get(client.id) === true);
      console.log("[trackbase-push]", {
        clientCount: clientList.length,
        clientIds: clientList.map((c) => c.id),
        focusMap: Array.from(focusedClients.entries()),
        hasFocusedClient,
        decision: hasFocusedClient ? "custom sound only" : "OS notification (default sound)",
      });
      if (hasFocusedClient) return null;

      return self.registration.showNotification(title, options);
    });

    event.waitUntil(notified);
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
