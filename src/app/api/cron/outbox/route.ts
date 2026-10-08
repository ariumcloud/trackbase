import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { admin } from "@/lib/supabase/server";
import { processCapiOutbox } from "@/lib/capi-outbox";
import { processWebhookInbox } from "@/lib/webhook-processor";
import { rateLimit } from "@/lib/security";

// Lightweight drain for the webhook inbox and the CAPI outbox. Meant to be
// pinged every few minutes (the full Meta sync stays on the daily cron).
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const a = Buffer.from(request.headers.get("authorization") ?? "");
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }
  if (!(await rateLimit("cron:outbox", 30))) {
    return NextResponse.json(
      { error: "Rotina já está em execução. Tente novamente em breve." },
      { status: 429, headers: { "Retry-After": "30" } },
    );
  }

  // Inbox first so a replayed sale reaches the CAPI outbox in this same run.
  const inbox = await processWebhookInbox(admin(), 20).catch(() => {
    console.error("Webhook inbox processing failed");
    return null;
  });
  const capi = await processCapiOutbox(20).catch(() => {
    console.error("CAPI outbox processing failed");
    return null;
  });

  return NextResponse.json({ ok: inbox !== null && capi !== null, inbox, capi });
}
