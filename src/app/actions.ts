"use server";
import { db, admin } from "@/lib/supabase/server";
import { authorize, digest, rateLimit, encrypt } from "@/lib/security";
import { linkSchema, webUrl } from "@/lib/utm";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
export type ActionResult = { ok?: boolean; error?: string };
export async function login(form: FormData): Promise<ActionResult> {
  const email = z.string().email().safeParse(form.get("email")),
    password = z.string().min(8).max(128).safeParse(form.get("password"));
  if (!email.success || !password.success)
    return { error: "Informe um e-mail e senha com pelo menos 8 caracteres." };
  const client = await db();
  const { error } = await client.auth.signInWithPassword({
    email: email.data,
    password: password.data,
  });
  if (error)
    return { error: "Não foi possível entrar. Confira e-mail e senha." };
  redirect("/painel");
}
export async function signup(form: FormData): Promise<ActionResult> {
  const email = z.string().email().safeParse(form.get("email")),
    password = z.string().min(10).max(128).safeParse(form.get("password"));
  if (!email.success || !password.success)
    return {
      error: "Use um e-mail válido e senha com pelo menos 10 caracteres.",
    };
  const client = await db();
  const { error } = await client.auth.signUp({
    email: email.data,
    password: password.data,
    options: { emailRedirectTo: `${process.env.APP_URL}/auth/callback` },
  });
  return error
    ? { error: "Não foi possível criar a conta. Tente novamente mais tarde." }
    : { ok: true };
}
export async function logout() {
  await (await db()).auth.signOut();
  redirect("/login");
}
export async function createWorkspace(form: FormData): Promise<ActionResult> {
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(100),
      timezone: z.string().max(80),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Informe o nome e o fuso horário." };
  const client = await db();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { error: "Entre na sua conta." };
  try {
    if (!(await rateLimit(`workspace:${user.id}`, 5)))
      return { error: "Aguarde um minuto para tentar novamente." };
    const { data, error } = await admin().rpc("utm_create_workspace", {
      p_user: user.id,
      p_name: parsed.data.name,
      p_timezone: parsed.data.timezone,
    });
    if (error) return { error: "Não foi possível criar o workspace." };
    revalidatePath("/painel");
    redirect(`/painel?workspace=${data}`);
  } catch (e) {
    if (e instanceof Error && e.message === "NEXT_REDIRECT") throw e;
    return {
      error:
        "Não foi possível criar o workspace. Verifique a configuração do servidor.",
    };
  }
}
export async function saveOffer(
  workspace: string,
  form: FormData,
): Promise<ActionResult> {
  try {
    const { client } = await authorize(workspace, true);
    const value = z
      .object({
        name: z.string().trim().min(2).max(120),
        landing_url: webUrl,
        currency: z.string().regex(/^[A-Z]{3}$/),
      })
      .parse(Object.fromEntries(form));
    const { error } = await client
      .from("utm_offers")
      .insert({ ...value, workspace_id: workspace });
    if (error) throw error;
    revalidatePath("/painel");
    return { ok: true };
  } catch {
    return {
      error: "Não foi possível salvar. Confira os campos e sua permissão.",
    };
  }
}
export async function saveLink(
  workspace: string,
  value: unknown,
): Promise<ActionResult> {
  try {
    const { client } = await authorize(workspace, true);
    const parsed = linkSchema.parse(value);
    const { error } = await client
      .from("utm_links")
      .insert({ ...parsed, workspace_id: workspace });
    if (error) throw error;
    revalidatePath("/painel");
    return { ok: true };
  } catch {
    return {
      error: "Não foi possível salvar o link. Confira a oferta e os campos.",
    };
  }
}
export async function toggleLink(
  workspace: string,
  id: string,
  active: boolean,
): Promise<ActionResult> {
  try {
    const { client } = await authorize(workspace, true);
    z.string().uuid().parse(id);
    const { error } = await client
      .from("utm_links")
      .update({ active })
      .eq("workspace_id", workspace)
      .eq("id", id);
    if (error) throw error;
    revalidatePath("/painel");
    return { ok: true };
  } catch {
    return { error: "Não foi possível alterar o link." };
  }
}
export async function savePaymentIntegration(
  workspace: string,
  form: FormData,
): Promise<ActionResult> {
  try {
    const { client } = await authorize(workspace, true);
    const value = z
      .object({
        provider: z.enum(["hotmart", "cakto"]),
        offer_id: z.string().uuid(),
        external_product_id: z.string().trim().min(1).max(200),
        external_offer_id: z.string().trim().max(200),
        currency: z.string().regex(/^[A-Z]{3}$/),
        secret: z.string().min(8).max(500),
      })
      .parse(Object.fromEntries(form));
    const { data: offer } = await client
      .from("utm_offers")
      .select("id,name")
      .eq("workspace_id", workspace)
      .eq("id", value.offer_id)
      .single();
    if (!offer) throw new Error();
    const service = admin();
    const { data, error } = await service
      .from("utm_integrations")
      .insert({
        workspace_id: workspace,
        offer_id: offer.id,
        provider: value.provider,
        name: `${value.provider} · ${offer.name}`,
        external_product_id: value.external_product_id,
        external_offer_id: value.external_offer_id || null,
        currency: value.currency,
      })
      .select("id")
      .single();
    if (error) throw error;
    const { error: secretError } = await service
      .from("utm_credentials")
      .insert({
        workspace_id: workspace,
        integration_id: data.id,
        webhook_hash: digest(value.secret),
      });
    if (secretError) {
      await service.from("utm_integrations").delete().eq("id", data.id);
      throw secretError;
    }
    revalidatePath("/painel");
    return { ok: true };
  } catch {
    return {
      error:
        "Não foi possível configurar. Verifique a oferta, o token e a configuração do servidor.",
    };
  }
}
export async function cleanupTests(workspace: string): Promise<ActionResult> {
  try {
    await authorize(workspace, true);
    const service = admin();
    const { error } = await service
      .from("utm_sales")
      .delete()
      .eq("workspace_id", workspace)
      .eq("is_test", true);
    if (error) throw error;
    revalidatePath("/painel");
    return { ok: true };
  } catch {
    return { error: "Não foi possível remover os dados de teste." };
  }
}

export async function savePixel(
  workspace: string,
  form: FormData,
): Promise<ActionResult> {
  try {
    await authorize(workspace, true);
    const parsed = z
      .object({
        pixel_id: z.string().trim().regex(/^\d{8,25}$/, "ID do Pixel inválido (deve conter apenas números)."),
        capi_token: z.string().trim().min(20, "O token de acesso CAPI da Meta deve ser preenchido."),
        offer_id: z.string().uuid().optional().or(z.literal("")),
        test_event_code: z.string().trim().max(50).optional(),
      })
      .parse(Object.fromEntries(form));

    const service = admin();
    const ciphertext = encrypt(parsed.capi_token);

    const { error } = await service.from("utm_pixels").upsert(
      {
        workspace_id: workspace,
        pixel_id: parsed.pixel_id,
        offer_id: parsed.offer_id ? parsed.offer_id : null,
        capi_token_ciphertext: ciphertext,
        test_event_code: parsed.test_event_code || null,
        active: true,
      },
      { onConflict: "workspace_id,pixel_id,offer_id" },
    );

    if (error) throw error;
    revalidatePath("/painel");
    return { ok: true };
  } catch (e) {
    return {
      error:
        e instanceof z.ZodError
          ? e.issues[0]?.message || "Dados inválidos."
          : "Não foi possível salvar a configuração do Pixel/CAPI.",
    };
  }
}

export async function deletePixel(
  workspace: string,
  pixelId: string,
): Promise<ActionResult> {
  try {
    await authorize(workspace, true);
    const service = admin();
    const { error } = await service
      .from("utm_pixels")
      .delete()
      .eq("workspace_id", workspace)
      .eq("id", pixelId);

    if (error) throw error;
    revalidatePath("/painel");
    return { ok: true };
  } catch {
    return { error: "Não foi possível excluir o Pixel." };
  }
}

export async function markAlertRead(
  workspace: string,
  alertId: string,
): Promise<ActionResult> {
  try {
    await authorize(workspace, true);
    const service = admin();
    const { error } = await service
      .from("utm_alerts")
      .update({ read: true })
      .eq("workspace_id", workspace)
      .eq("id", alertId);

    if (error) throw error;
    revalidatePath("/painel");
    return { ok: true };
  } catch {
    return { error: "Não foi possível atualizar o alerta." };
  }
}

