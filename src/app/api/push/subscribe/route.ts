import { NextResponse } from "next/server";
import { z } from "zod";
import { admin, db } from "@/lib/supabase/server";
import { body, rateLimit, sameOrigin } from "@/lib/security";
import { isVapidConfigured } from "@/lib/push-notifications";

const subscribeSchema = z.object({
  workspace_id: z.string().uuid(),
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string(),
      auth: z.string(),
    }),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url().max(4096),
});

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    if (!isVapidConfigured) {
      return NextResponse.json(
        { error: "Notificações ainda não foram configuradas no servidor." },
        { status: 503 },
      );
    }
    const {
      data: { user },
    } = await (await db()).auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    if (!(await rateLimit(`push:${user.id}`, 10))) {
      return NextResponse.json({ error: "Muitas tentativas." }, { status: 429 });
    }
    const json = await body(request, 8192);
    const parsed = subscribeSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const { workspace_id, subscription } = parsed.data;
    const service = admin();

    // Check membership
    const { data: member } = await service
      .from("utm_members")
      .select("role")
      .eq("workspace_id", workspace_id)
      .eq("user_id", user.id)
      .single();

    if (!member) {
      return NextResponse.json(
        { error: "Workspace não autorizado." },
        { status: 403 },
      );
    }

    // Upsert push subscription based on (workspace_id, endpoint)
    const { error: upsertError } = await service
      .from("utm_push_subscriptions")
      .upsert(
        {
          workspace_id,
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id,endpoint" },
      );

    if (upsertError) {
      console.error("Erro ao salvar push subscription:", upsertError);
      return NextResponse.json(
        { error: "Falha ao salvar inscrição." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("push subscribe error:", err);
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const {
      data: { user },
    } = await (await db()).auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    if (!(await rateLimit(`push:${user.id}`, 10))) {
      return NextResponse.json({ error: "Muitas tentativas." }, { status: 429 });
    }
    const parsed = unsubscribeSchema.safeParse(await body(request, 4096));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Endpoint não informado." },
        { status: 400 },
      );
    }
    const { endpoint } = parsed.data;

    const service = admin();
    await service
      .from("utm_push_subscriptions")
      .delete()
      .eq("endpoint", endpoint)
      .eq("user_id", user.id);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 },
    );
  }
}
