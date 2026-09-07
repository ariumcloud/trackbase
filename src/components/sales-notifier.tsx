"use client";

import { useEffect, useState } from "react";
import { Bell, Volume2 } from "lucide-react";

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
      // Register SW
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

      // Listen to postMessages from SW when sales arrive
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

    try {
      const registration = await navigator.serviceWorker.ready;

      if (isSubscribed) {
        // Unsubscribe
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
        // Subscribe
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          alert("Permissão de notificações não concedida no seu navegador.");
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
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <button
          type="button"
          className={`button small ${isSubscribed ? "primary" : "ghost"}`}
          disabled={loading || !workspaceId}
          onClick={toggleSubscription}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            fontSize: "0.8rem",
            padding: "0.35rem 0.75rem",
          }}
          title={isSubscribed ? "Notificações ativas" : "Receber alertas de venda com som"}
        >
          <Bell size={14} className={isSubscribed ? "text-white" : ""} />
          <span>{isSubscribed ? "Vendas Ativas" : "Ativar Notificações"}</span>
        </button>

        <button
          type="button"
          className="button small ghost"
          onClick={() => {
            playKaching();
            setToastMessage("💰 Som de venda testado!");
            setTimeout(() => setToastMessage(null), 3000);
          }}
          title="Testar som de venda (Kaching)"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.3rem",
            padding: "0.35rem 0.6rem",
            fontSize: "0.78rem",
          }}
        >
          <Volume2 size={14} />
          <span>Testar Som</span>
        </button>
      </div>

      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 9999,
            background: "#17152F",
            color: "#FFFFFF",
            padding: "1rem 1.25rem",
            borderRadius: "12px",
            boxShadow: "0 12px 32px rgba(23, 21, 47, 0.35)",
            border: "1px solid rgba(91, 52, 234, 0.4)",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            animation: "slideIn 0.3s ease-out",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "#5B34EA",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
            }}
          >
            💰
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>Trackbase Notificações</div>
            <div style={{ fontSize: "0.82rem", opacity: 0.85 }}>{toastMessage}</div>
          </div>
        </div>
      )}
    </>
  );
}
