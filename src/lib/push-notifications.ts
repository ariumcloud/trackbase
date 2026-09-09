import "server-only";
import webpush from "web-push";
import { admin } from "./supabase/server";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
let rawSubject = process.env.VAPID_SUBJECT || "mailto:contato@trackbase.com.br";
if (rawSubject && !rawSubject.startsWith("mailto:") && !rawSubject.startsWith("http")) {
  rawSubject = `mailto:${rawSubject}`;
}
const vapidSubject = rawSubject;

export let isVapidConfigured = false;
try {
  if (vapidPublicKey && vapidPrivateKey && vapidPublicKey.length > 20 && vapidPrivateKey.length > 20) {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    isVapidConfigured = true;
  } else {
    throw new Error("Invalid or missing VAPID keys in ENV");
  }
} catch {
  console.warn("VAPID is not configured; push notifications are disabled.");
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

    // Query all active push subscriptions for this workspace (ordered by updated_at desc)
    const { data: subs, error } = await service
      .from("utm_push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth, updated_at")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false });

    if (!isVapidConfigured) {
      console.warn("VAPID is not configured.");
      return { ok: false, count: 0, reason: "vapid_not_configured" };
    }

    if (error) {
      console.error("Error querying subscriptions:", error);
      return { ok: false, count: 0, reason: error.message };
    }

    if (!subs || subs.length === 0) {
      return { ok: false, count: 0, reason: "no_subscribers" };
    }

    // Blindagem de aparelho: mantém estritamente 1 único aparelho ativo (o mais recente) por usuário
    // e purga automaticamente inscrições antigas, duplicadas ou de navegadores de desktop
    const latestByUser = new Map<string, (typeof subs)[0]>();
    const staleIds: string[] = [];

    for (const sub of subs) {
      if (!latestByUser.has(sub.user_id)) {
        latestByUser.set(sub.user_id, sub);
      } else {
        staleIds.push(sub.id);
      }
    }

    if (staleIds.length > 0) {
      await service.from("utm_push_subscriptions").delete().in("id", staleIds);
    }

    const activeSubs = Array.from(latestByUser.values());

    // Fetch workspace push settings (if customized)
    const { data: ws } = await service
      .from("utm_workspaces")
      .select("push_settings")
      .eq("id", workspaceId)
      .maybeSingle();

    const pushSettings = ws?.push_settings as
      | {
          title_template?: string;
          body_template?: string;
          show_buyer?: boolean;
        }
      | undefined;

    const formattedAmount = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: event.currency || "BRL",
    }).format(event.amount);

    const buyerName =
      pushSettings?.show_buyer === false
        ? ""
        : event.buyerName?.trim() || "Cliente";
    const productName = event.productName?.trim() || "Oferta Principal";
    const providerUpper = (event.provider || "").toUpperCase();

    let title = pushSettings?.title_template || "💰 Venda Realizada: {valor}!";
    let body =
      pushSettings?.body_template ||
      "Opa, caiu mais uma! {produto} via {provedor}.";

    // Replace placeholders
    title = title
      .replace(/\{valor\}/gi, formattedAmount)
      .replace(/\{produto\}/gi, productName)
      .replace(/\{provedor\}/gi, providerUpper)
      .replace(/\{comprador\}/gi, buyerName);

    body = body
      .replace(/\{valor\}/gi, formattedAmount)
      .replace(/\{produto\}/gi, productName)
      .replace(/\{provedor\}/gi, providerUpper)
      .replace(/\{comprador\}/gi, buyerName);

    const payload = JSON.stringify({
      title,
      body,
      url: `/painel?workspace=${workspaceId}&tab=visao`,
      tag: `sale-${Date.now()}`,
      timestamp: Date.now(),
    });

    // Send push to each registered subscriber
    const deadSubIds: string[] = [];
    let sentCount = 0;
    let failedCount = 0;

    await Promise.all(
      activeSubs.map(async (sub) => {
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
          sentCount++;
        } catch (err: unknown) {
          failedCount++;
          const statusCode =
            typeof err === "object" && err !== null && "statusCode" in err
              ? (err as { statusCode: number }).statusCode
              : 0;
          if (statusCode === 404 || statusCode === 410) {
            deadSubIds.push(sub.id);
          } else {
            console.error("Falha ao entregar push de venda", { subscriptionId: sub.id, statusCode });
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

    if (sentCount === 0 && failedCount > 0) {
      return { ok: false, count: 0, total: activeSubs.length, reason: "push_delivery_failed" };
    }
    return { ok: true, count: sentCount, total: activeSubs.length };
  } catch (err) {
    console.error("notifySalePush error:", err);
    return { ok: false, count: 0, reason: String(err) };
  }
}
