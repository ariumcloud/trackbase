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
      // nenhuma aba visível e focada existe — ou seja, quando o usuário
      // realmente não está olhando para o app.
      const hasFocusedVisibleClient = clientList.some(
        (client) => client.focused && client.visibilityState === "visible",
      );
      if (hasFocusedVisibleClient) return null;

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
