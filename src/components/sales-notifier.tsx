"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Bell, Volume2, BellRing } from "lucide-react";
import { soundPlayer } from "@/lib/sound";
import { handlePushSound, PUSH_VERSION } from "@/lib/push-client";

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

function hasSameApplicationServerKey(
  currentKey: ArrayBuffer | null,
  expectedKey: Uint8Array,
) {
  if (!currentKey) return false;
  const current = new Uint8Array(currentKey);
  return current.length === expectedKey.length && current.every((value, index) => value === expectedKey[index]);
}

function isMobileEnvironment() {
  if (typeof window === "undefined") return false;
  const userAgent = navigator.userAgent || "";
  const isTouch = "ontouchstart" in window || (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0);
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) ||
    (window.innerWidth <= 768 && isTouch)
  );
}

export function SalesNotifier({ workspaceId }: Props) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const playManualSound = useCallback(async () => {
    const result = await soundPlayer.play();
    setToastMessage(result.status === "started" ? "💰 Som de venda tocado." : "O navegador bloqueou o áudio. Toque novamente para testar.");
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // O worker envia um MessagePort e espera a confirmação real da reprodução.
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "TRACKBASE_PUSH_SOUND") {
        void handlePushSound(event, workspaceId).then(() => {
          const payload = event.data?.payload;
          setToastMessage(`${payload?.title || "💰 Venda Realizada!"} ${payload?.body ? `— ${payload.body}` : ""}`);
          setTimeout(() => setToastMessage(null), 7000);
        });
      } else if (event.data?.type === "PLAY_SALE_SOUND") {
        void soundPlayer.play();
        const payload = event.data?.data;
        if (payload?.title) {
          setToastMessage(`${payload.title} ${payload.body ? `— ${payload.body}` : ""}`);
          setTimeout(() => setToastMessage(null), 7000);
        }
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);

    // Registra e sincroniza o Service Worker se houver suporte a PushManager
    if ("PushManager" in window) {
      navigator.serviceWorker
        .register(`/sw.js?v=${PUSH_VERSION}`, { updateViaCache: "none" })
        .then(async (registration) => {
          await registration.update();
          const subscription = await registration.pushManager.getSubscription();
          if (!subscription) {
            setIsSubscribed(false);
            return;
          }

          const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          const expectedKey = publicKey ? urlBase64ToUint8Array(publicKey) : null;

          if (!expectedKey || !hasSameApplicationServerKey(subscription.options.applicationServerKey, expectedKey)) {
            await subscription.unsubscribe();
            await fetch("/api/push/subscribe", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ endpoint: subscription.endpoint }),
            });
            setIsSubscribed(false);
            setToastMessage("As notificações precisam ser ativadas novamente neste aparelho.");
            setTimeout(() => setToastMessage(null), 7000);
            return;
          }

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

          if (res.ok) {
            setIsSubscribed(true);
          }
        })
        .catch((err) => {
          console.warn("SW register error:", err);
        });
    }

    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
    };
  }, [workspaceId]);

  const toggleSubscription = async () => {
    if (!workspaceId) return;
    setLoading(true);

    if (!isMobileEnvironment()) {
      alert(
        "📱 As notificações de venda com o som da máquina registradora são exclusivas para Celular!\n\nAbra o Trackbase no seu iPhone (Safari > Adicionar à Tela de Início) ou celular Android e toque em 'Ativar Vendas' lá para o aparelho tocar a cada venda aprovada."
      );
      setLoading(false);
      return;
    }

    if (!("Notification" in window) || !("PushManager" in window)) {
      alert(
        "No iPhone/iOS, as notificações push só funcionam se você adicionar o app à Tela de Início:\n\n1. Abra o Safari e toque no botão de Compartilhar (quadrado com seta para cima);\n2. Escolha 'Adicionar à Tela de Início';\n3. Abra o app pelo ícone criado na sua tela e ative as notificações aqui!",
      );
      setLoading(false);
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

        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!publicKey || publicKey.length < 20) {
          throw new Error("As notificações ainda não foram configuradas no servidor.");
        }

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
          const response = await res.json().catch(() => null);
          throw new Error(
            response?.error || "Não foi possível salvar a inscrição no servidor.",
          );
        }

        setIsSubscribed(true);
        // Prime the audio context while this click is still the user gesture.
        void soundPlayer.unlockAudio();
        setToastMessage("Notificações ativadas. Com o painel aberto, o Trackbase tentará o som personalizado; em segundo plano, o iOS usa o som padrão.");
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
          title={isSubscribed ? "Notificações de venda ativas (clique para desativar)" : "Ativar alertas de venda"}
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
          onClick={() => { void playManualSound(); }}
          title="Testar som de venda (Kaching)"
          aria-label="Testar som de venda"
        >
          <Volume2 size={15} />
          <span className="notifier-sound-text">Testar Som</span>
        </button>
      </div>

      {toastMessage && mounted && typeof document !== "undefined" && createPortal(
        <div className="sales-toast" role="status">
          <div className="sales-toast-icon">💰</div>
          <div className="sales-toast-content">
            <div className="sales-toast-title">Trackbase Notificações</div>
            <div className="sales-toast-body">{toastMessage}</div>
          </div>
        </div>,
        document.body
      )}

      {/* Elemento de áudio nativo no DOM para máxima compatibilidade com iOS Safari e Android */}
      <audio
        id="cash-machine-player"
        src="/cash-machine.mp3"
        preload="auto"
        playsInline
        style={{ display: "none" }}
      />
    </>
  );
}
