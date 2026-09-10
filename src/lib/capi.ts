import "server-only";
import { canUse } from "./plans";
import { admin } from "./supabase/server";
import { decrypt } from "./security";
import { graphVersion } from "./meta";
import {
  type CapiEventName,
  type CapiUserData,
  type CapiCustomData,
  type CapiPayload,
  hashPii,
  normalizeCapiUserData,
} from "./capi-shared";

export type { CapiEventName, CapiUserData, CapiCustomData, CapiPayload };
export { hashPii, normalizeCapiUserData };

export async function sendCapiEvent(payload: CapiPayload): Promise<{
  status: "sent" | "failed" | "skipped" | "duplicate";
  error?: string;
}> {
  const service = admin();
  const { data: workspace, error: planError } = await service
    .from("utm_workspaces")
    .select("plan")
    .eq("id", payload.workspaceId)
    .single();
  if (planError || !workspace || !canUse(workspace.plan, "capi"))
    return { status: "skipped", error: "CAPI indisponível para este plano." };

  // 1. Busca o Pixel ativo (específico da oferta ou padrão do workspace)
  let query = service
    .from("utm_pixels")
    .select("pixel_id,offer_id,capi_token_ciphertext,test_event_code")
    .eq("workspace_id", payload.workspaceId)
    .eq("active", true);

  if (payload.offerId) {
    query = query.or(`offer_id.eq.${payload.offerId},offer_id.is.null`);
  } else {
    query = query.is("offer_id", null);
  }

  const { data: pixels, error: pixelError } = await query;
  if (pixelError) return { status: "failed", error: "CAPI_PIXEL_LOOKUP_FAILED" };
  if (!pixels || pixels.length === 0) {
    return {
      status: "skipped",
      error: "Nenhum pixel CAPI configurado para o workspace.",
    };
  }

  const specific = pixels.filter((p) => payload.offerId && p.offer_id === payload.offerId);
  const candidates = specific.length ? specific : pixels.filter((p) => p.offer_id === null);
  if (candidates.length !== 1) return { status: "failed", error: "CAPI_PIXEL_AMBIGUOUS" };
  const pixel = candidates[0];
  let token: string;
  try {
    token = decrypt(pixel.capi_token_ciphertext);
  } catch {
    return { status: "failed", error: "Falha ao descriptografar token CAPI." };
  }

  // 2. Prevenção de duplicata no log da CAPI
  const { data: existing, error: logReadError } = await service
    .from("utm_capi_logs")
    .select("status")
    .eq("workspace_id", payload.workspaceId)
    .eq("pixel_id", pixel.pixel_id)
    .eq("event_id", payload.eventId)
    .eq("event_name", payload.eventName)
    .maybeSingle();
  if (logReadError) return { status: "failed", error: "CAPI_LOG_LOOKUP_FAILED" };

  if (existing?.status === "sent" || existing?.status === "skipped") {
    return { status: "duplicate" };
  }

  // 3. Montagem do payload Meta
  const userData = normalizeCapiUserData(payload.userData);
  const eventItem: Record<string, unknown> = {
    event_name: payload.eventName,
    event_time: Math.floor(Date.parse(payload.occurredAt || new Date().toISOString()) / 1000),
    event_id: payload.eventId,
    action_source: "website",
    event_source_url: payload.url || undefined,
    user_data: userData,
  };

  if (payload.customData) {
    const cd: Record<string, unknown> = {};
    if (payload.customData.value != null) cd.value = payload.customData.value;
    if (payload.customData.currency) cd.currency = payload.customData.currency;
    if (payload.customData.content_name)
      cd.content_name = payload.customData.content_name;
    if (payload.customData.content_type)
      cd.content_type = payload.customData.content_type;
    if (payload.customData.content_ids)
      cd.content_ids = payload.customData.content_ids;
    if (Object.keys(cd).length > 0) eventItem.custom_data = cd;
  }

  const metaBody: Record<string, unknown> = {
    data: [eventItem],
  };

  if (pixel.test_event_code) {
    metaBody.test_event_code = pixel.test_event_code;
  }

  const endpoint = `https://graph.facebook.com/${graphVersion()}/${pixel.pixel_id}/events`;

  let status: "sent" | "failed" = "failed";
  let httpCode = 0;
  let responseSummary = "Falha de rede";
  let retryCount = 0;

  for (let attempt = 0; attempt < 2; attempt++) {
    retryCount = attempt;
    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(metaBody),
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });

      httpCode = resp.status;
      const json = await resp.json().catch(() => null);

      if (resp.ok) {
        status = "sent";
        responseSummary = `events_received: ${json?.events_received ?? 1}`;
        break;
      } else {
        responseSummary = `Meta HTTP ${httpCode}; código ${Number(json?.error?.code) || 0}`;
        if (httpCode < 500 && httpCode !== 408 && httpCode !== 429) {
          // Erros 4xx permanentes (ex.: token inválido) não devem sofrer retry.
          break;
        }
      }
    } catch {
      responseSummary = "Falha de rede ou timeout";
    }
  }

  // 4. Registro seguro do log CAPI sem salvar tokens nem PII
  const { error: logWriteError } = await service.from("utm_capi_logs").upsert(
    {
      workspace_id: payload.workspaceId,
      pixel_id: pixel.pixel_id,
      event_id: payload.eventId,
      event_name: payload.eventName,
      status,
      http_code: httpCode,
      response_summary: responseSummary,
      retry_count: retryCount,
    },
    {
      onConflict: "workspace_id,pixel_id,event_id,event_name",
      ignoreDuplicates: false,
    },
  );
  if (logWriteError) return { status: "failed", error: "CAPI_LOG_WRITE_FAILED" };

  return { status, error: status === "failed" ? responseSummary : undefined };
}
