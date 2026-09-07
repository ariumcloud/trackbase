import "server-only";
import webpush from "web-push";
import { admin } from "./supabase/server";

const vapidPublicKey =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BCUQChXv4HEiaFXIllkn3E4_-6a3SE_Aks-xTeO4TPvTLH0Az0yDvJhM8fsfuaDVnvzfE-OG2GQv1er2bqzmzmk";
const vapidPrivateKey =
  process.env.VAPID_PRIVATE_KEY ||
  "5JjWTKB67jaxsWhKQfrfDrk0OZCTMypTYaez7uD7Nq0";
const vapidSubject =
  process.env.VAPID_SUBJECT || "mailto:suporte@trackbase.com.br";

let isVapidConfigured = false;
try {
  if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    isVapidConfigured = true;
  }
} catch (e) {
  console.warn("VAPID details could not be set:", e);
}

export type SalePushEvent = {
  amount: number;
  currency: string;
  buyerName?: string | null;
  productName?: string | null;
  provider: string;
};

export async function notifySalePush(
  workspaceId: string,
  event: SalePushEvent,
) {
  try {
    const service = admin();

    // Query all active push subscriptions for this workspace
    const { data: subs, error } = await service
      .from("utm_push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("workspace_id", workspaceId);

    if (error || !subs || subs.length === 0) {
      return;
    }

    const formattedAmount = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: event.currency || "BRL",
    }).format(event.amount);

    const buyerText = event.buyerName ? ` de ${event.buyerName}` : "";
    const productText = event.productName ? ` · ${event.productName}` : "";
    const providerUpper = (event.provider || "").toUpperCase();

    const payload = JSON.stringify({
      title: `💰 Venda Realizada: ${formattedAmount}!`,
      body: `Nova venda aprovada${buyerText}${productText} via ${providerUpper}.`,
      url: `/painel?workspace=${workspaceId}&tab=visao`,
      tag: `sale-${Date.now()}`,
      sound: "/kaching.wav",
      timestamp: Date.now(),
    });

    if (!isVapidConfigured) {
      return;
    }

    // Send push to each registered subscriber
    const deadSubIds: string[] = [];

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            payload,
            {
              TTL: 60 * 60,
              urgency: "high",
            },
          );
        } catch (err: unknown) {
          const statusCode =
            typeof err === "object" && err !== null && "statusCode" in err
              ? (err as { statusCode: number }).statusCode
              : 0;
          if (statusCode === 404 || statusCode === 410) {
            deadSubIds.push(sub.id);
          }
        }
      }),
    );

    // Clean up stale subscriptions
    if (deadSubIds.length > 0) {
      await service
        .from("utm_push_subscriptions")
        .delete()
        .in("id", deadSubIds);
    }
  } catch (err) {
    console.error("notifySalePush error:", err);
  }
}
