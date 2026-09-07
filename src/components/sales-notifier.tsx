"use client";

import { useEffect, useState } from "react";
import { Bell, Volume2, BellRing } from "lucide-react";

type Props = {
  workspaceId: string;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function SalesNotifier({ workspaceId }: Props) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Play sound function
  const playKaching = () => {
    try {
      const audio = new Audio("/kaching.wav");
      audio.volume = 0.85;
      audio.play().catch((err) => {
        console.log("Audio play blocked until user interacts:", err);
      });
    } catch (e) {
      console.warn("Could not play kaching audio:", e);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          return registration.pushManager.getSubscription();
        })
        .then((subscription) => {
          setIsSubscribed(Boolean(subscription));
        })
        .catch((err) => {
          console.warn("SW register error:", err);
        });

      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === "PLAY_SALE_SOUND") {
          playKaching();
          if (event.data?.data?.title) {
            setToastMessage(`${event.data.data.title} - ${event.data.data.body}`);
            setTimeout(() => setToastMessage(null), 7000);
          }
        }
      };

      navigator.serviceWorker.addEventListener("message", handleMessage);
      return () => {
        navigator.serviceWorker.removeEventListener("message", handleMessage);
      };
    }
  }, []);

  const toggleSubscription = async () => {
    if (!workspaceId) return;
    setLoading(true);

    if (!("Notification" in window) || !("PushManager" in window)) {
      alert(
        "No iPhone/iOS, as notificações push só funcionam se você adicionar o app à Tela de Início:\n\n1. Abra o Safari e toque no botão de Compartilhar (quadrado com seta para cima);\n2. Escolha 'Adicionar à Tela de Início';\n3. Abra o app pelo ícone criado na sua tela e ative as notificações aqui!",
      );
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      if (isSubscribed) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          });
        }
        setIsSubscribed(false);
        setToastMessage("Notificações desativadas.");
        setTimeout(() => setToastMessage(null), 3000);
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          alert(
            "Permissão de notificações não concedida.\nSe estiver no iPhone, vá em Ajustes > Safari (ou Trackbase) > Notificações e permita alertas.",
          );
          setLoading(false);
          return;
        }

        const publicKey =
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
          "BCUQChXv4HEiaFXIllkn3E4_-6a3SE_Aks-xTeO4TPvTLH0Az0yDvJhM8fsfuaDVnvzfE-OG2GQv1er2bqzmzmk";

        const convertedKey = urlBase64ToUint8Array(publicKey);

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey,
        });

        const subJson = subscription.toJSON();

        const res = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspace_id: workspaceId,
            subscription: {
              endpoint: subJson.endpoint,
              keys: {
                p256dh: subJson.keys?.p256dh,
                auth: subJson.keys?.auth,
              },
            },
          }),
        });

        if (!res.ok) {
          throw new Error("Erro ao salvar inscrição no servidor.");
        }

        setIsSubscribed(true);
        playKaching();
        setToastMessage("Notificações de Venda ativadas com sucesso!");
        setTimeout(() => setToastMessage(null), 4000);
      }
    } catch (e: unknown) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Erro ao configurar notificações.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="sales-notifier-cluster">
        <button
          type="button"
          className={`notifier-btn ${isSubscribed ? "active" : ""}`}
          disabled={loading || !workspaceId}
          onClick={toggleSubscription}
          title={isSubscribed ? "Notificações de venda ativas (Clique para desativar)" : "Ativar alertas de venda com som de caixa registradora"}
          aria-label="Notificações de venda"
        >
          {isSubscribed ? (
            <>
              <BellRing size={15} className="notifier-icon-pulse" />
              <span className="notifier-text">Alertas Ativos</span>
              <span className="notifier-status-badge">ON</span>
            </>
          ) : (
            <>
              <Bell size={15} />
              <span className="notifier-text">Ativar Vendas</span>
            </>
          )}
        </button>

        <button
          type="button"
          className="notifier-btn-sound"
          onClick={() => {
            playKaching();
            setToastMessage("💰 Som de venda testado! (Kaching)");
            setTimeout(() => setToastMessage(null), 3000);
          }}
          title="Testar som de venda (Kaching)"
          aria-label="Testar som de venda"
        >
          <Volume2 size={15} />
          <span className="notifier-sound-text">Testar Som</span>
        </button>
      </div>

      {toastMessage && (
        <div className="sales-toast" role="status">
          <div className="sales-toast-icon">💰</div>
          <div className="sales-toast-content">
            <div className="sales-toast-title">Trackbase Notificações</div>
            <div className="sales-toast-body">{toastMessage}</div>
          </div>
        </div>
      )}
    </>
  );
}
