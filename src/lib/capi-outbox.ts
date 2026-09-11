import "server-only";
import { sendCapiEvent, type CapiEventName, type CapiUserData } from "./capi";
import { decrypt } from "./security";
import { admin } from "./supabase/server";

type OutboxEvent = {
  id: string;
  workspace_id: string;
  offer_id: string;
  event_id: string;
  event_name: CapiEventName;
  event_source_url: string;
  user_data_ciphertext: string;
  attempt_count: number;
  occurred_at?: string | null;
  value?: number | null;
  currency?: string | null;
};

type OutboxSummary = {
  claimed: number;
  sent: number;
  skipped: number;
  retried: number;
  failed: number;
};

function retryAt(attempt: number) {
  const delaySeconds = Math.min(60 * 2 ** Math.max(0, attempt - 1), 3_600);
  return new Date(Date.now() + delaySeconds * 1_000).toISOString();
}

function safeError(value: unknown) {
  return value instanceof Error ? value.name : "CAPI_PROCESSING_FAILED";
}

export async function processCapiOutbox(limit = 10): Promise<OutboxSummary> {
  const service = admin();
  const { data, error } = await service.rpc("utm_claim_capi_outbox", { p_limit: limit });
  if (error) throw new Error("CAPI_OUTBOX_CLAIM_FAILED");

  const events = (data ?? []) as OutboxEvent[];
  const summary: OutboxSummary = { claimed: events.length, sent: 0, skipped: 0, retried: 0, failed: 0 };

  for (const event of events) {
    try {
      const userData = JSON.parse(decrypt(event.user_data_ciphertext)) as CapiUserData;
      const result = await sendCapiEvent({
        workspaceId: event.workspace_id,
        offerId: event.offer_id,
        eventName: event.event_name,
        eventId: event.event_id,
        url: event.event_source_url,
        userData,
        occurredAt: event.occurred_at || undefined,
        customData:
          event.value != null && event.currency
            ? { value: event.value, currency: event.currency }
            : undefined,
      });

      if (result.status === "sent" || result.status === "duplicate") {
        await service.from("utm_capi_outbox").update({
          status: "sent",
          locked_at: null,
          last_error: null,
          updated_at: new Date().toISOString(),
        }).eq("id", event.id).eq("status", "processing");
        summary.sent++;
      } else if (result.status === "skipped") {
        await service.from("utm_capi_outbox").update({
          status: "skipped",
          locked_at: null,
          last_error: result.error?.slice(0, 300) ?? null,
          updated_at: new Date().toISOString(),
        }).eq("id", event.id).eq("status", "processing");
        summary.skipped++;
      } else {
        const terminal = event.attempt_count >= 5;
        await service.from("utm_capi_outbox").update({
          status: terminal ? "failed" : "retry",
          locked_at: null,
          next_attempt_at: terminal ? new Date().toISOString() : retryAt(event.attempt_count),
          last_error: result.error?.slice(0, 300) ?? "CAPI_SEND_FAILED",
          updated_at: new Date().toISOString(),
        }).eq("id", event.id).eq("status", "processing");
        if (terminal) summary.failed++;
        else summary.retried++;
      }
    } catch (error) {
      const terminal = event.attempt_count >= 5;
      await service.from("utm_capi_outbox").update({
        status: terminal ? "failed" : "retry",
        locked_at: null,
        next_attempt_at: terminal ? new Date().toISOString() : retryAt(event.attempt_count),
        last_error: safeError(error),
        updated_at: new Date().toISOString(),
      }).eq("id", event.id).eq("status", "processing");
      if (terminal) summary.failed++;
      else summary.retried++;
    }
  }

  return summary;
}
