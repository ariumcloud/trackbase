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

    const userAgent = request.headers.get("user-agent") || "";
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(userAgent);
    if (!isMobile) {
      return NextResponse.json(
        { error: "As notificações de venda com som devem ser ativadas exclusivamente no seu celular (iPhone ou Android)." },
        { status: 400 },
      );
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

    // Blindagem de aparelho: remove inscrições anteriores deste usuário no workspace
    // para assegurar que apenas o aparelho mais recente receba as notificações (1 por usuário)
    await service
      .from("utm_push_subscriptions")
      .delete()
      .eq("workspace_id", workspace_id)
      .eq("user_id", user.id);

    const { error: insertError } = await service
      .from("utm_push_subscriptions")
      .insert({
        workspace_id,
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error("Erro ao salvar push subscription:", insertError);
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
