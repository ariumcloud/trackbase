"use server";
import { requireFeature } from "@/lib/feature-access";
import { db, admin } from "@/lib/supabase/server";
import { authorize, digest, rateLimit, encrypt, decrypt } from "@/lib/security";
import { listGatewayProducts, type CatalogProvider } from "@/lib/gateway-catalog";
import { linkSchema, webUrl } from "@/lib/utm";
import { normalizeCheckoutUrl } from "@/lib/tracker";
import { validateDocument } from "@/lib/document";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createApiKey as createKeyRecord, listApiKeys as listKeyRecords, revokeApiKey as revokeKeyRecord } from "@/lib/api-keys";
import { DEFAULT_PLATFORM_FEES, type PaymentProvider } from "@/lib/payment-contract";
export type ActionResult = {
  ok?: boolean;
  error?: string;
  integrationId?: string;
  offerId?: string;
  products?: Array<{
    externalProductId: string;
    externalOfferId: string | null;
    name: string;
    currency: string;
    price: number | null;
  }>;
};
export async function login(form: FormData): Promise<ActionResult> {
  const email = z.string().email().safeParse(form.get("email")),
    password = z.string().min(8).max(128).safeParse(form.get("password"));
  if (!email.success || !password.success)
    return { error: "Informe um e-mail e senha com pelo menos 8 caracteres." };
  if (!(await rateLimit(`login:${email.data.toLowerCase()}`, 5)))
    return { error: "Muitas tentativas. Aguarde um minuto para tentar novamente." };
  const client = await db();
  const { error } = await client.auth.signInWithPassword({
    email: email.data,
    password: password.data,
  });
  if (error)
    return { error: "Não foi possível entrar. Confira e-mail e senha." };
  redirect("/painel");
}
export async function requestPasswordReset(form: FormData): Promise<ActionResult> {
  const email = z.string().email().safeParse(form.get("email"));
  if (!email.success) return { error: "Informe um e-mail válido." };
  if (!(await rateLimit(`password-reset:${email.data.toLowerCase()}`, 3)))
    return { ok: true };
  const client = await db();
  const { error } = await client.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${process.env.APP_URL}/auth/callback?next=/recuperar-senha/atualizar`,
  });
  return error
    ? { error: "Não foi possível enviar o e-mail de recuperação." }
    : { ok: true };
}

export async function updatePassword(form: FormData): Promise<ActionResult> {
  const password = z.string().min(10).max(128).safeParse(form.get("password"));
  if (!password.success) return { error: "A senha precisa ter pelo menos 10 caracteres." };
  const client = await db();
  const { error } = await client.auth.updateUser({ password: password.data });
  if (error) return { error: "Não foi possível atualizar a senha." };
  redirect("/login?password=updated");
}
export async function signup(form: FormData): Promise<ActionResult> {
  const fullName = z
    .string()
    .trim()
    .min(3)
    .max(120)
    .refine((value) => value.split(/\s+/).filter(Boolean).length >= 2)
    .safeParse(form.get("full_name")),
    email = z.string().email().safeParse(form.get("email")),
    phone = z
      .string()
      .trim()
      .regex(/^\+?[0-9\s().-]{10,20}$/)
      .safeParse(form.get("phone")),
    rawDoc = form.get("document"),
    password = z.string().min(10).max(128).safeParse(form.get("password"));

  if (!fullName.success || !email.success || !phone.success || !password.success) {
    return {
      error:
        "Informe seu nome completo, além de e-mail, celular e uma senha com pelo menos 10 caracteres.",
    };
  }

  const docValidation = validateDocument(
    typeof rawDoc === "string" ? rawDoc : "",
  );
  if (!docValidation.valid) {
    return {
      error:
        docValidation.error ||
        "Informe um CPF ou CNPJ válido para criar sua conta.",
    };
  }

  if (!(await rateLimit(`signup:${email.data.toLowerCase()}`, 3))) {
    return {
      error: "Muitas tentativas. Aguarde um minuto para tentar novamente.",
    };
  }

  if (!(await rateLimit(`signup:doc:${docValidation.clean}`, 3))) {
    return {
      error: "Muitas tentativas com este documento. Aguarde um minuto.",
    };
  }

  // Previne criação de contas duplicadas com o mesmo CPF ou CNPJ
  try {
    const service = admin();
    const { data: usersData, error: listError } =
      await service.auth.admin.listUsers({ perPage: 1000 });
    if (!listError && usersData?.users) {
      const isDuplicate = usersData.users.some((u) => {
        const meta = u.user_metadata as Record<string, unknown> | undefined;
        return (
          meta?.document === docValidation.clean ||
          meta?.cpf === docValidation.clean ||
          meta?.cnpj === docValidation.clean
        );
      });
      if (isDuplicate) {
        return {
          error:
            "Este CPF/CNPJ já está cadastrado em outra conta. Acesse 'Entrar' ou recupere sua senha.",
        };
      }
    }
  } catch (err) {
    console.error("Erro ao verificar duplicidade de documento:", err);
  }

  const client = await db();
  const { error } = await client.auth.signUp({
    email: email.data,
    password: password.data,
    options: {
      emailRedirectTo: `${process.env.APP_URL}/auth/callback`,
      data: {
        full_name: fullName.data,
        name: fullName.data,
        phone: phone.data,
        document: docValidation.clean,
        document_formatted: docValidation.formatted,
        document_type: docValidation.type,
        app: "trackbase",
      },
    },
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
    if (error) {
      if (error.message?.includes("Limite de workspaces")) {
        return { error: "Limite de workspaces atingido para o seu plano." };
      }
      return { error: "Não foi possível criar o workspace." };
    }
    revalidatePath("/painel");
    redirect(`/painel?workspace=${data}`);
  } catch (e) {
    const err = e as Error & { digest?: string };
    if (err?.message === "NEXT_REDIRECT" || (err?.digest && err.digest.startsWith("NEXT_REDIRECT"))) throw e;
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Limite de workspaces")) {
      return { error: "Limite de workspaces atingido para o seu plano." };
    }
    return {
      error:
        "Não foi possível criar o workspace. Verifique a configuração do servidor.",
    };
  }
}
export async function deleteWorkspace(
  workspace: string,
  form: FormData,
): Promise<ActionResult> {
  try {
    const { user, role } = await authorize(workspace, true);
    if (role !== "owner") return { error: "Somente a pessoa proprietária pode excluir este workspace." };
    const confirmation = z.string().trim().safeParse(form.get("confirmation"));
    if (!confirmation.success || confirmation.data !== "EXCLUIR") {
      return { error: "Digite EXCLUIR para confirmar." };
    }
    const service = admin();
    const { data: alternatives, error: alternativesError } = await service
      .from("utm_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .neq("workspace_id", workspace)
      .limit(1);
    if (alternativesError) throw alternativesError;
    const { error } = await service.rpc("utm_delete_workspace", {
      p_user: user.id,
      p_workspace: workspace,
    });
    if (error) throw error;
    revalidatePath("/painel");
    const nextWorkspace = alternatives?.[0]?.workspace_id;
    redirect(nextWorkspace ? `/painel?workspace=${nextWorkspace}` : "/painel");
  } catch (e) {
    const err = e as Error & { digest?: string };
    if (err?.message === "NEXT_REDIRECT" || (err?.digest && err.digest.startsWith("NEXT_REDIRECT"))) throw e;
    console.error("Workspace deletion failed", { message: err?.message });
    if (err?.message?.includes("Somente o proprietário")) {
      return { error: "Somente a pessoa proprietária pode excluir este workspace." };
    }
    if (err?.message?.includes("utm_delete_workspace") || err?.message?.includes("does not exist")) {
      return { error: "A função de exclusão ainda não está instalada no Supabase. Aplique a migration mais recente e tente de novo." };
    }
    return { error: "Não foi possível excluir este workspace." };
  }
}

export async function renameWorkspace(workspace: string, form: FormData): Promise<ActionResult> {
  try {
    await authorize(workspace, true);
    const values = z.object({ name: z.string().trim().min(2).max(100), default_currency: z.enum(["BRL", "USD", "EUR", "MXN", "COP"]) }).safeParse(Object.fromEntries(form));
    if (!values.success) return { error: "Informe um nome e uma moeda padrão válidos." };
    const { error } = await admin()
      .from("utm_workspaces")
      .update({ name: values.data.name, default_currency: values.data.default_currency })
      .eq("id", workspace);
    if (error) throw error;
    revalidatePath("/painel");
    return { ok: true };
  } catch (e) {
    console.error("Workspace rename failed", { message: e instanceof Error ? e.message : "unknown" });
    return { error: "Não foi possível renomear este workspace." };
  }
}
function parseFormDecimal(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (typeof val === "string") {
    const cleaned = val.replace(",", ".").trim();
    const num = Number(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

export async function saveOffer(
  workspace: string,
  form: FormData,
): Promise<ActionResult> {
  try {
    const { client } = await authorize(workspace, true);
    const raw = Object.fromEntries(form);
    const value = z
      .object({
        name: z.string().trim().min(2).max(120),
        landing_url: z.preprocess(
          (v) => (typeof v === "string" ? v.trim() : v),
          webUrl,
        ),
        currency: z.string().regex(/^[A-Z]{3}$/),
        product_type: z
          .enum([
            "main",
            "upsell",
            "downsell",
            "order_bump",
            "subscription",
            "complementary",
            "alternative",
          ])
          .optional()
          .default("main"),
        parent_offer_id: z.string().uuid().optional().or(z.literal("")),
        external_product_id: z.string().trim().max(200).optional().or(z.literal("")),
        external_offer_id: z.string().trim().max(200).optional().or(z.literal("")),
        percent_fee: z
          .preprocess(parseFormDecimal, z.number().min(0).max(100))
          .optional()
          .default(0),
        fixed_fee: z
          .preprocess(parseFormDecimal, z.number().min(0))
          .optional()
          .default(0),
        cost_per_sale: z
          .preprocess(parseFormDecimal, z.number().min(0))
          .optional()
          .default(0),
        platform: z
          .enum([
            "hotmart",
            "kiwify",
            "cakto",
            "kirvano",
            "eduzz",
            "monetizze",
            "wiapy",
            "lowfy",
            "greenn",
            "stripe",
          ])
          .optional()
          .or(z.literal("")),
        checkout_url: z.preprocess(
          (v) => (typeof v === "string" && v.trim() ? normalizeCheckoutUrl(v)?.href || v.trim() : undefined),
          webUrl.optional(),
        ),
      })
      .parse(raw);

    const defaultFees = value.platform ? DEFAULT_PLATFORM_FEES[value.platform as PaymentProvider] : null;
    const percentFee =
      value.percent_fee !== undefined && value.percent_fee > 0
        ? value.percent_fee
        : (defaultFees?.percent ?? 0);
    const fixedFee =
      value.fixed_fee !== undefined && value.fixed_fee > 0
        ? value.fixed_fee
        : (defaultFees?.fixed ?? 0);

    const { error } = await client.from("utm_offers").insert({
      workspace_id: workspace,
      name: value.name,
      landing_url: value.landing_url,
      currency: value.currency,
      product_type: value.product_type,
      parent_offer_id: value.parent_offer_id ? value.parent_offer_id : null,
      external_product_id: value.external_product_id || null,
      external_offer_id: value.external_offer_id || null,
      percent_fee: percentFee,
      fixed_fee: fixedFee,
      cost_per_sale: value.cost_per_sale ?? 0,
      platform: value.platform ? value.platform : null,
      checkout_url: value.checkout_url || null,
    });
    if (error) {
      if (error.message?.includes("Limite de ofertas")) {
        return { error: "Limite de ofertas atingido para o plano deste workspace." };
      }
      throw error;
    }
    revalidatePath("/painel");
    return { ok: true };
  } catch (err: unknown) {
    console.error("saveOffer error:", err);
    if (err instanceof z.ZodError) {
      return {
        error: `Dados inválidos: ${err.issues.map((i) => i.message).join(", ")}`,
      };
    }
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Limite de ofertas")) {
      return { error: "Limite de ofertas atingido para o plano deste workspace." };
    }
    return {
      error: msg || "Não foi possível salvar. Confira os campos e sua permissão.",
    };
  }
}
export async function updateOffer(workspace: string, id: string, form: FormData): Promise<ActionResult> {
  try {
    await authorize(workspace, true);
    const value = z.object({
      name: z.string().trim().min(2).max(120),
      landing_url: z.preprocess(
        (v) => (typeof v === "string" ? v.trim() : v),
        webUrl,
      ),
      currency: z.string().regex(/^[A-Z]{3}$/),
      product_type: z.enum(["main", "upsell", "downsell", "order_bump", "subscription", "complementary", "alternative"]).optional().default("main"),
      parent_offer_id: z.string().uuid().optional().or(z.literal("")),
      percent_fee: z
        .preprocess(parseFormDecimal, z.number().min(0).max(100))
        .optional(),
      fixed_fee: z
        .preprocess(parseFormDecimal, z.number().min(0))
        .optional(),
      cost_per_sale: z
        .preprocess(parseFormDecimal, z.number().min(0))
        .optional()
        .default(0),
      platform: z.enum(["hotmart", "kiwify", "cakto", "kirvano", "eduzz", "monetizze", "wiapy", "lowfy", "greenn", "stripe"]).optional().or(z.literal("")),
      checkout_url: z.preprocess(
        (v) => (typeof v === "string" && v.trim() ? normalizeCheckoutUrl(v)?.href || v.trim() : undefined),
        webUrl.optional(),
      ),
    }).parse(Object.fromEntries(form));
    z.string().uuid().parse(id);

    const defaultFees = value.platform ? DEFAULT_PLATFORM_FEES[value.platform as PaymentProvider] : null;
    const percentFee =
      value.percent_fee !== undefined && value.percent_fee > 0
        ? value.percent_fee
        : (defaultFees?.percent ?? 0);
    const fixedFee =
      value.fixed_fee !== undefined && value.fixed_fee > 0
        ? value.fixed_fee
        : (defaultFees?.fixed ?? 0);

    const service = admin();
    const { data: oldOffer } = await service
      .from("utm_offers")
      .select("name")
      .eq("workspace_id", workspace)
      .eq("id", id)
      .maybeSingle();

    const parentOfferId =
      value.parent_offer_id && value.parent_offer_id !== id
        ? value.parent_offer_id
        : null;

    const { error } = await service
      .from("utm_offers")
      .update({
        name: value.name,
        landing_url: value.landing_url,
        currency: value.currency,
        product_type: value.product_type,
        parent_offer_id: parentOfferId,
        platform: value.platform || null,
        checkout_url: value.checkout_url || null,
        percent_fee: percentFee,
        fixed_fee: fixedFee,
        cost_per_sale: value.cost_per_sale ?? 0,
      })
      .eq("workspace_id", workspace)
      .eq("id", id);

    if (error) throw error;
    if (oldOffer && oldOffer.name !== value.name) {
      await service
        .from("utm_integrations")
        .update({ name: `${value.platform ? value.platform.toUpperCase() : "OFERTA"} · ${value.name}` })
        .eq("workspace_id", workspace)
        .eq("offer_id", id);
    }
    revalidatePath("/painel"); return { ok: true };
  } catch (err: unknown) {
    console.error("updateOffer error:", err);
    if (err instanceof z.ZodError) {
      return {
        error: `Dados inválidos: ${err.issues.map((i) => i.message).join(", ")}`,
      };
    }
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Limite de ofertas")) {
      return { error: "Limite de ofertas atingido para o plano deste workspace." };
    }
    return { error: msg || "Não foi possível atualizar a oferta. Confira os campos." };
  }
}
export async function deleteOffer(workspace: string, id: string): Promise<ActionResult> {
  try {
    await authorize(workspace, true);
    z.string().uuid().parse(id);
    const service = admin();

    // 1. Run primary lookups and decoupled cleanups in parallel
    const [
      { count: salesCount },
      { data: integrations },
    ] = await Promise.all([
      service
        .from("utm_sales")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspace)
        .eq("offer_id", id),
      service
        .from("utm_integrations")
        .select("id")
        .eq("workspace_id", workspace)
        .eq("offer_id", id),
      service
        .from("utm_offers")
        .update({ parent_offer_id: null })
        .eq("workspace_id", workspace)
        .eq("parent_offer_id", id),
      service
        .from("utm_pixels")
        .update({ offer_id: null })
        .eq("workspace_id", workspace)
        .eq("offer_id", id),
      service
        .from("utm_links")
        .delete()
        .eq("workspace_id", workspace)
        .eq("offer_id", id),
    ]);

    // 2. Clean up integrations linked to this offer in parallel
    const ids = (integrations || []).map((item) => item.id);
    if (ids.length) {
      await Promise.all([
        service.from("utm_credentials").delete().eq("workspace_id", workspace).in("integration_id", ids),
        service.from("utm_webhook_logs").delete().eq("workspace_id", workspace).in("integration_id", ids),
        service.from("utm_meta_action_logs").delete().eq("workspace_id", workspace).in("integration_id", ids),
        service.from("utm_insights").delete().eq("workspace_id", workspace).in("integration_id", ids),
        service.from("utm_ad_entities").delete().eq("workspace_id", workspace).in("integration_id", ids),
        service.from("utm_sales").delete().eq("workspace_id", workspace).in("integration_id", ids),
      ]);
      await service.from("utm_integrations").delete().eq("workspace_id", workspace).in("id", ids);
    }

    // 3. Delete or soft-delete the offer
    if (salesCount && salesCount > 0) {
      const { error } = await service
        .from("utm_offers")
        .update({ active: false })
        .eq("workspace_id", workspace)
        .eq("id", id);
      if (error) throw error;
    } else {
      const { error: deleteError } = await service
        .from("utm_offers")
        .delete()
        .eq("workspace_id", workspace)
        .eq("id", id);
      if (deleteError) {
        await service
          .from("utm_offers")
          .update({ active: false })
          .eq("workspace_id", workspace)
          .eq("id", id);
      }
    }

    revalidatePath("/painel");
    return { ok: true };
  } catch (err) {
    console.error("deleteOffer failed:", err);
    return { error: "Não foi possível excluir o produto." };
  }
}

export async function deleteIntegration(workspace: string, id: string): Promise<ActionResult> {
  try {
    await authorize(workspace, true);
    z.string().uuid().parse(id);
    const service = admin();

    const { data: integration, error: getErr } = await service
      .from("utm_integrations")
      .select("id, provider, offer_id, status")
      .eq("workspace_id", workspace)
      .eq("id", id)
      .maybeSingle();

    if (getErr || !integration) {
      return { error: "Integração não encontrada ou já removida." };
    }

    // Parallel cleanup of all dependent tables
    await Promise.all([
      service.from("utm_credentials").delete().eq("workspace_id", workspace).eq("integration_id", id),
      service.from("utm_webhook_logs").delete().eq("workspace_id", workspace).eq("integration_id", id),
      service.from("utm_meta_action_logs").delete().eq("workspace_id", workspace).eq("integration_id", id),
      service.from("utm_insights").delete().eq("workspace_id", workspace).eq("integration_id", id),
      service.from("utm_ad_entities").delete().eq("workspace_id", workspace).eq("integration_id", id),
      service.from("utm_sales").delete().eq("workspace_id", workspace).eq("integration_id", id),
    ]);

    // Delete the integration
    const { error: delErr } = await service
      .from("utm_integrations")
      .delete()
      .eq("workspace_id", workspace)
      .eq("id", id);

    if (delErr) throw delErr;

    // Clean up orphaned offer in parallel if needed
    if (integration.offer_id) {
      const [
        { count: offerSales },
        { count: offerLinks },
        { count: otherIntegrations },
      ] = await Promise.all([
        service
          .from("utm_sales")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspace)
          .eq("offer_id", integration.offer_id),
        service
          .from("utm_links")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspace)
          .eq("offer_id", integration.offer_id),
        service
          .from("utm_integrations")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspace)
          .eq("offer_id", integration.offer_id),
      ]);

      if (
        (!offerSales || offerSales === 0) &&
        (!offerLinks || offerLinks === 0) &&
        (!otherIntegrations || otherIntegrations === 0)
      ) {
        await service
          .from("utm_offers")
          .delete()
          .eq("workspace_id", workspace)
          .eq("id", integration.offer_id);
      }
    }

    revalidatePath("/painel");
    return { ok: true };
  } catch (err) {
    console.error("deleteIntegration failed:", err);
    return { error: "Não foi possível excluir a integração." };
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
    if (error) {
      if (error.message?.includes("Limite de links")) {
        return { error: "Limite de links atingido para o plano deste workspace." };
      }
      throw error;
    }
    revalidatePath("/painel");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Limite de links")) {
      return { error: "Limite de links atingido para o plano deste workspace." };
    }
    return {
      error: "Não foi possível salvar o link. Confira a oferta e os campos.",
    };
  }
}
export async function updateLink(workspace: string, id: string, value: unknown): Promise<ActionResult> {
  try {
    const { client } = await authorize(workspace, true);
    z.string().uuid().parse(id);
    const parsed = linkSchema.parse(value);
    const { error } = await client.from("utm_links").update(parsed).eq("workspace_id", workspace).eq("id", id);
    if (error) throw error;
    revalidatePath("/painel"); return { ok: true };
  } catch { return { error: "Não foi possível atualizar o link. Confira os campos." }; }
}
export async function deleteLink(workspace: string, id: string): Promise<ActionResult> {
  try {
    const { client } = await authorize(workspace, true);
    z.string().uuid().parse(id);
    const { error } = await client.from("utm_links").delete().eq("workspace_id", workspace).eq("id", id);
    if (error) throw error;
    revalidatePath("/painel"); return { ok: true };
  } catch { return { error: "Não foi possível excluir o link." }; }
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
    const { client } = await requireFeature(workspace, "integrations");
    const value = z
      .object({
        provider: z.enum([
          "hotmart",
          "kiwify",
          "cakto",
          "kirvano",
          "eduzz",
          "monetizze",
          "wiapy",
          "lowfy",
          "greenn",
          "stripe",
        ]),
        offer_id: z.string().optional(),
        product_name: z.string().trim().max(120).optional(),
        external_product_id: z.string().trim().min(1).max(200),
        external_offer_id: z.string().trim().max(200).optional(),
        currency: z.string().regex(/^[A-Z]{3}$/),
        secret: z.string().min(4).max(500).optional().or(z.literal("")),
      })
      .parse(Object.fromEntries(form));

    const service = admin();
    let finalOfferId = value.offer_id;
    let finalOfferName = "";

    if (finalOfferId && finalOfferId !== "new" && z.string().uuid().safeParse(finalOfferId).success) {
      const { data: existingOffer } = await client
        .from("utm_offers")
        .select("id,name")
        .eq("workspace_id", workspace)
        .eq("id", finalOfferId)
        .single();
      if (existingOffer) {
        finalOfferId = existingOffer.id;
        finalOfferName = existingOffer.name;
      }
    }

    if (!finalOfferName) {
      const defaultLandingUrl: Record<string, string> = {
        hotmart: "https://hotmart.com",
        kiwify: "https://kiwify.com.br",
        cakto: "https://cakto.com.br",
      };
      const landingUrl = defaultLandingUrl[value.provider] || "https://trackbase.com.br";
      const offerName = value.product_name || value.external_product_id;
      const defaultFees = DEFAULT_PLATFORM_FEES[value.provider as PaymentProvider];

      const { data: createdOffer, error: offerError } = await service
        .from("utm_offers")
        .insert({
          workspace_id: workspace,
          name: offerName,
          landing_url: landingUrl,
          currency: value.currency,
          platform: value.provider,
          external_product_id: value.external_product_id,
          percent_fee: defaultFees?.percent ?? 0,
          fixed_fee: defaultFees?.fixed ?? 0,
        })
        .select("id,name")
        .single();

      if (offerError || !createdOffer) throw offerError || new Error("Não foi possível criar a oferta.");
      finalOfferId = createdOffer.id;
      finalOfferName = createdOffer.name;
    }

    const { data, error } = await service
      .from("utm_integrations")
      .insert({
        workspace_id: workspace,
        offer_id: finalOfferId,
        provider: value.provider,
        name: `${value.provider.toUpperCase()} · ${finalOfferName}`,
        external_product_id: value.external_product_id,
        external_offer_id: value.external_offer_id || null,
        currency: value.currency,
        status: "connected",
      })
      .select("id")
      .single();
    if (error) {
      if (error.message?.includes("Limite de integrações")) {
        return { error: "Limite de integrações atingido para o plano deste workspace." };
      }
      throw error;
    }

    let webhookHash = value.secret ? digest(value.secret) : null;
    let webhookSecretCiphertext = value.secret ? encrypt(value.secret) : null;

    if (!webhookHash || !webhookSecretCiphertext) {
      const { data: existingIntegrations } = await service
        .from("utm_integrations")
        .select("id")
        .eq("workspace_id", workspace)
        .eq("provider", value.provider);

      const ids = existingIntegrations?.map((int) => int.id) || [];
      if (ids.length > 0) {
        const { data: existingCred } = await service
          .from("utm_credentials")
          .select("webhook_hash, webhook_secret_ciphertext")
          .in("integration_id", ids)
          .not("webhook_hash", "is", null)
          .limit(1)
          .maybeSingle();

        if (existingCred?.webhook_hash) {
          webhookHash = existingCred.webhook_hash;
          webhookSecretCiphertext = existingCred.webhook_secret_ciphertext;
        }
      }
    }

    if (!webhookHash || !webhookSecretCiphertext) {
      return { error: "Informe o token/Hottok para autenticar a conexão." };
    }

    const { error: secretError } = await service
      .from("utm_credentials")
      .insert({
        workspace_id: workspace,
        integration_id: data.id,
        webhook_hash: webhookHash,
        webhook_secret_ciphertext: webhookSecretCiphertext,
      });
    if (secretError) {
      await service.from("utm_integrations").delete().eq("id", data.id);
      throw secretError;
    }

    await service
      .from("utm_integrations")
      .update({ status: "connected" })
      .eq("id", data.id)
      .eq("workspace_id", workspace);
    revalidatePath("/painel");
    return { ok: true, integrationId: data.id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Limite de integrações")) {
      return { error: "Limite de integrações atingido para o plano deste workspace." };
    }
    return {
      error:
        "Não foi possível configurar. Verifique a oferta, o token e a configuração do servidor.",
    };
  }
}

export async function connectImportedGateway(
  workspace: string,
  form: FormData,
): Promise<ActionResult> {
  let stage = "validar acesso";
  let provider = "gateway";
  try {
    await requireFeature(workspace, "integrations");
    const value = z.object({
      provider: z.enum(["hotmart", "kiwify", "cakto"]),
      client_id: z.string().trim().min(3).max(300),
      client_secret: z.string().trim().min(4).max(1000),
      account_id: z.string().trim().max(300).optional(),
      basic_token: z.string().trim().max(1000).optional(),
      webhook_secret: z.string().trim().max(500).optional(),
      external_product_id: z.string().trim().min(1).max(300),
    }).parse(Object.fromEntries(form));
    provider = value.provider;

    const credentials = {
      clientId: value.client_id,
      clientSecret: value.client_secret,
      accountId: value.account_id || undefined,
      basicToken: value.basic_token || undefined,
    };
    stage = "consultar produto no gateway";
    const products = await listGatewayProducts(value.provider as CatalogProvider, credentials);
    const product = products.find((item) => item.externalProductId === value.external_product_id);
    if (!product) return { error: "O produto selecionado não está mais disponível. Busque novamente." };

    const service = admin();
    const landingUrl = product.checkoutUrl || {
      hotmart: "https://hotmart.com",
      kiwify: "https://kiwify.com.br",
      cakto: "https://cakto.com.br",
    }[value.provider];
    stage = "criar produto no Trackbase";
    const { data: offer, error: offerError } = await service
      .from("utm_offers")
      .insert({
        workspace_id: workspace,
        name: product.name,
        landing_url: landingUrl,
        checkout_url: product.checkoutUrl,
        currency: product.currency,
        platform: value.provider,
        external_product_id: product.externalProductId,
        external_offer_id: product.externalOfferId,
      })
      .select("id")
      .single();
    if (offerError || !offer) throw offerError || new Error("Não foi possível criar a oferta.");

    stage = "criar integração";
    const { data: integration, error: integrationError } = await service
      .from("utm_integrations")
      .insert({
        workspace_id: workspace,
        offer_id: offer.id,
        provider: value.provider,
        name: `${value.provider.toUpperCase()} · ${product.name}`,
        external_product_id: product.externalProductId,
        external_offer_id: product.externalOfferId,
        currency: product.currency,
        status: value.webhook_secret && value.webhook_secret.length >= 4 ? "connected" : "pending",
      })
      .select("id")
      .single();
    if (integrationError || !integration) {
      await service.from("utm_offers").delete().eq("id", offer.id).eq("workspace_id", workspace);
      throw integrationError || new Error("Não foi possível criar a integração.");
    }

    stage = "proteger credenciais";
    const { error: credentialError } = await service.from("utm_credentials").insert({
      workspace_id: workspace,
      integration_id: integration.id,
      webhook_hash: value.webhook_secret ? digest(value.webhook_secret) : null,
      webhook_secret_ciphertext: value.webhook_secret
        ? encrypt(value.webhook_secret)
        : null,
      api_credentials_ciphertext: encrypt(JSON.stringify(credentials)),
    });
    if (credentialError) {
      await service.from("utm_integrations").delete().eq("id", integration.id).eq("workspace_id", workspace);
      await service.from("utm_offers").delete().eq("id", offer.id).eq("workspace_id", workspace);
      throw credentialError;
    }
    revalidatePath("/painel");
    return { ok: true, integrationId: integration.id, offerId: offer.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("Falha ao importar produto do gateway", {
      provider,
      workspace,
      stage,
      error: message || "Erro desconhecido",
    });
    if (message.includes("Limite")) return { error: message };
    if (message.includes("Chave de criptografia")) {
      return { error: "A chave de criptografia do servidor não está configurada. Avise o suporte da Trackbase." };
    }
    if (message.includes("Credencial do servidor")) {
      return { error: "A credencial segura do servidor não está configurada. Avise o suporte da Trackbase." };
    }
    if (message.includes("token") || message.includes("Credenciais") || message.includes("permissão")) {
      const providerLabel = { cakto: "Cakto", kiwify: "Kiwify", hotmart: "Hotmart" }[provider as CatalogProvider] || provider;
      return { error: `A ${providerLabel} recusou a consulta do produto. Confira as permissões da chave.` };
    }
    return { error: `Não foi possível concluir a etapa “${stage}”. Tente novamente em alguns segundos.` };
  }
}
export async function listSavedGatewayProducts(
  workspace: string,
  integration: string,
): Promise<ActionResult> {
  try {
    await requireFeature(workspace, "integrations");
    const service = admin();
    const { data: connection, error: connectionError } = await service
      .from("utm_integrations")
      .select("provider")
      .eq("workspace_id", workspace)
      .eq("id", integration)
      .single();
    if (connectionError || !connection) throw connectionError || new Error();
    const { data: credential, error: credentialError } = await service
      .from("utm_credentials")
      .select("api_credentials_ciphertext")
      .eq("workspace_id", workspace)
      .eq("integration_id", integration)
      .single();
    if (credentialError || !credential?.api_credentials_ciphertext) throw credentialError || new Error();
    const credentials = JSON.parse(decrypt(credential.api_credentials_ciphertext)) as Record<string, string | undefined>;
    const products = await listGatewayProducts(connection.provider as CatalogProvider, {
      clientId: credentials.clientId || "",
      clientSecret: credentials.clientSecret || "",
      accountId: credentials.accountId,
      basicToken: credentials.basicToken,
    });
    return { ok: true, products };
  } catch {
    return { error: "Não foi possível carregar os produtos desta conexão." };
  }
}

export async function connectAdditionalGatewayProduct(
  workspace: string,
  integration: string,
  externalProductId: string,
): Promise<ActionResult> {
  try {
    await requireFeature(workspace, "integrations");
    const service = admin();
    const { data: source, error: sourceError } = await service
      .from("utm_integrations")
      .select("provider")
      .eq("workspace_id", workspace)
      .eq("id", integration)
      .single();
    if (sourceError || !source) throw sourceError || new Error();
    const { data: credential, error: credentialError } = await service
      .from("utm_credentials")
      .select("api_credentials_ciphertext")
      .eq("workspace_id", workspace)
      .eq("integration_id", integration)
      .single();
    if (credentialError || !credential?.api_credentials_ciphertext) throw credentialError || new Error();
    const credentials = JSON.parse(decrypt(credential.api_credentials_ciphertext)) as Record<string, string | undefined>;
    const products = await listGatewayProducts(source.provider as CatalogProvider, {
      clientId: credentials.clientId || "",
      clientSecret: credentials.clientSecret || "",
      accountId: credentials.accountId,
      basicToken: credentials.basicToken,
    });
    const product = products.find((item) => item.externalProductId === externalProductId);
    if (!product) return { error: "O produto selecionado não está mais disponível." };
    const landingUrl = product.checkoutUrl || ({
      hotmart: "https://hotmart.com",
      kiwify: "https://kiwify.com.br",
      cakto: "https://cakto.com.br",
    }[source.provider as CatalogProvider] || "https://trackbase.com.br");
    const { data: offer, error: offerError } = await service.from("utm_offers").insert({
      workspace_id: workspace,
      name: product.name,
      landing_url: landingUrl,
      checkout_url: product.checkoutUrl,
      currency: product.currency,
      platform: source.provider,
      external_product_id: product.externalProductId,
      external_offer_id: product.externalOfferId,
    }).select("id").single();
    if (offerError || !offer) throw offerError || new Error();
    const { data: created, error: integrationError } = await service.from("utm_integrations").insert({
      workspace_id: workspace,
      offer_id: offer.id,
      provider: source.provider,
      name: `${source.provider.toUpperCase()} · ${product.name}`,
      external_product_id: product.externalProductId,
      external_offer_id: product.externalOfferId,
      currency: product.currency,
      status: "pending",
    }).select("id").single();
    if (integrationError || !created) {
      await service.from("utm_offers").delete().eq("id", offer.id).eq("workspace_id", workspace);
      throw integrationError || new Error();
    }
    const { error: newCredentialError } = await service.from("utm_credentials").insert({
      workspace_id: workspace,
      integration_id: created.id,
      api_credentials_ciphertext: credential.api_credentials_ciphertext,
    });
    if (newCredentialError) throw newCredentialError;
    revalidatePath("/painel");
    return { ok: true, integrationId: created.id, offerId: offer.id };
  } catch {
    return { error: "Não foi possível adicionar este produto." };
  }
}

export async function saveGatewayWebhookSecret(
  workspace: string,
  integration: string,
  secret: string,
): Promise<ActionResult> {
  try {
    await requireFeature(workspace, "integrations");
    const value = z.object({
      integration: z.string().uuid(),
      secret: z.string().trim().min(4).max(500),
    }).parse({ integration, secret });
    const service = admin();
    const { error } = await service
      .from("utm_credentials")
      .update({
        webhook_hash: digest(value.secret),
        webhook_secret_ciphertext: encrypt(value.secret),
      })
      .eq("workspace_id", workspace)
      .eq("integration_id", value.integration);
    if (error) throw error;
    const { error: integrationError } = await service
      .from("utm_integrations")
      .update({ status: "connected" })
      .eq("workspace_id", workspace)
      .eq("id", value.integration);
    if (integrationError) throw integrationError;
    revalidatePath("/painel");
    return { ok: true };
  } catch {
    return { error: "Não foi possível salvar o secret do webhook." };
  }
}
export async function removeGatewayWebhookSecret(
  workspace: string,
  integration: string,
): Promise<ActionResult> {
  try {
    await requireFeature(workspace, "integrations");
    const value = z.object({ integration: z.string().uuid() }).parse({ integration });
    const service = admin();
    const { error } = await service
      .from("utm_credentials")
      .update({ webhook_hash: null, webhook_secret_ciphertext: null })
      .eq("workspace_id", workspace)
      .eq("integration_id", value.integration);
    if (error) throw error;
    const { error: integrationError } = await service
      .from("utm_integrations")
      .update({ status: "pending" })
      .eq("workspace_id", workspace)
      .eq("id", value.integration);
    if (integrationError) throw integrationError;
    revalidatePath("/painel");
    return { ok: true };
  } catch {
    return { error: "Não foi possível remover o webhook." };
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
    await requireFeature(workspace, "capi");
    const parsed = z
      .object({
        pixel_id: z
          .string()
          .trim()
          .regex(
            /^\d{8,25}$/,
            "ID do Pixel inválido (deve conter apenas números).",
          ),
        capi_token: z
          .string()
          .trim()
          .min(20, "O token de acesso CAPI da Meta deve ser preenchido."),
        offer_id: z.string().uuid().optional().or(z.literal("")),
        test_event_code: z.string().trim().max(50).optional(),
      })
      .parse(Object.fromEntries(form));

    const service = admin();
    const ciphertext = encrypt(parsed.capi_token);

    // Busca se já existe registro deste pixel para o workspace e oferta
    let query = service
      .from("utm_pixels")
      .select("id")
      .eq("workspace_id", workspace)
      .eq("pixel_id", parsed.pixel_id);

    if (parsed.offer_id) {
      query = query.eq("offer_id", parsed.offer_id);
    } else {
      query = query.is("offer_id", null);
    }

    const { data: existing, error: findError } = await query.maybeSingle();
    if (findError) {
      console.error("Erro ao consultar pixel existente:", findError);
    }

    let saveError: { message?: string } | null = null;
    if (existing?.id) {
      const { error } = await service
        .from("utm_pixels")
        .update({
          capi_token_ciphertext: ciphertext,
          test_event_code: parsed.test_event_code || null,
          active: true,
        })
        .eq("id", existing.id);
      saveError = error;
    } else {
      const { error } = await service.from("utm_pixels").insert({
        workspace_id: workspace,
        pixel_id: parsed.pixel_id,
        offer_id: parsed.offer_id ? parsed.offer_id : null,
        capi_token_ciphertext: ciphertext,
        test_event_code: parsed.test_event_code || null,
        active: true,
      });
      saveError = error;
    }

    if (saveError) {
      console.error("Erro ao gravar utm_pixels:", saveError);
      throw new Error(saveError.message || "Erro no banco de dados ao salvar o Pixel.");
    }

    revalidatePath("/painel");
    return { ok: true };
  } catch (e: unknown) {
    console.error("Erro ao salvar configuração do Pixel/CAPI:", e);
    return {
      error:
        e instanceof z.ZodError
          ? e.issues[0]?.message || "Dados inválidos."
          : e instanceof Error
            ? e.message
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

export async function saveDiagnosticAction(
  workspace: string,
  data: {
    offer_id?: string | null;
    url?: string | null;
    score: number;
    category_scores: unknown;
    bottlenecks: unknown[];
    recommendations: string[];
    metrics_snapshot: Record<string, unknown>;
  },
): Promise<ActionResult> {
  try {
    const { client } = await authorize(workspace, true);
    const { error } = await client.from("utm_funnel_diagnostics").insert({
      workspace_id: workspace,
      offer_id: data.offer_id || null,
      url: data.url || null,
      score: Math.max(0, Math.min(100, Math.round(data.score))),
      category_scores: data.category_scores || {},
      bottlenecks: data.bottlenecks || [],
      recommendations: data.recommendations || [],
      metrics_snapshot: data.metrics_snapshot || {},
    });

    if (error) throw error;
    revalidatePath("/painel");
    return { ok: true };
  } catch {
    return { error: "Não foi possível salvar o diagnóstico." };
  }
}

export async function savePushSettings(
  workspace: string,
  data: {
    title_template: string;
    body_template: string;
    show_buyer: boolean;
  },
): Promise<ActionResult> {
  try {
    await authorize(workspace, true);
    const parsed = z
      .object({
        title_template: z.string().trim().min(2).max(150),
        body_template: z.string().trim().min(2).max(300),
        show_buyer: z.boolean(),
      })
      .safeParse(data);

    if (!parsed.success) {
      return { error: "Parâmetros de notificação inválidos." };
    }

    const service = admin();
    const { error } = await service
      .from("utm_workspaces")
      .update({
        push_settings: parsed.data,
      })
      .eq("id", workspace);

    if (error) {
      console.error("savePushSettings DB error:", error);
      return { error: "Erro ao gravar configurações no banco de dados." };
    }

    revalidatePath("/painel");
    return { ok: true };
  } catch (err) {
    console.error("savePushSettings catch error:", err);
    return { error: "Não foi possível salvar as configurações de notificação." };
  }
}

export async function sendTestPushAction(
  workspace: string,
): Promise<ActionResult & { count?: number; eventId?: string }> {
  try {
    await authorize(workspace, true);
    const { notifySalePush } = await import("@/lib/push-notifications");
    const result = await notifySalePush(workspace, {
      amount: 197.0,
      currency: "BRL",
      buyerName: "Lucas Silva",
      productName: "Oferta Escala Black",
      provider: "HOTMART",
    });

    if (result && !result.ok) {
      if (result.reason === "no_subscribers") {
        return {
          error:
            "Nenhum celular conectado neste workspace! Abra o Trackbase no seu iPhone (adicionado à Tela de Início) e clique no botão 'Ativar Vendas' (sininho) no topo para cadastrar este aparelho.",
        };
      }
      return {
        error: `Falha ao disparar push: ${result.reason || "Erro interno"}`,
      };
    }

    return { ok: true, count: result?.count ?? 1, eventId: result?.id };
  } catch (err) {
    console.error("sendTestPushAction error:", err);
    return { error: "Não foi possível disparar o teste de notificação." };
  }
}

export async function createShield(
  workspace: string,
  form: FormData,
): Promise<ActionResult> {
  try {
    const { client } = await authorize(workspace, true);
    const parsed = z
      .object({
        name: z.string().trim().min(2).max(100),
        offer_id: z.string().uuid(),
        slug: z
          .string()
          .trim()
          .toLowerCase()
          .regex(
            /^[a-z0-9\-_]{3,64}$/,
            "O slug deve ter entre 3 e 64 caracteres (apenas letras minúsculas, números e traços).",
          ),
        custom_domain: z
          .string()
          .trim()
          .toLowerCase()
          .regex(
            /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/,
            "Domínio inválido. Use um formato como: oferta.meusite.com",
          )
          .optional()
          .or(z.literal("")),
        white_url: webUrl,
        gray_url: webUrl,
        black_url: webUrl,
        require_click_id: z.preprocess((v) => v === "true" || v === "on" || v === true, z.boolean()),
        block_datacenters: z.preprocess((v) => v === "true" || v === "on" || v === true, z.boolean()),
        block_unknown_user_agents: z.preprocess((v) => v === "true" || v === "on" || v === true, z.boolean()),
      })
      .parse(Object.fromEntries(form));

    const { error } = await client.from("utm_shields").insert({
      workspace_id: workspace,
      offer_id: parsed.offer_id,
      name: parsed.name,
      slug: parsed.slug,
      custom_domain: parsed.custom_domain ? parsed.custom_domain : null,
      white_url: parsed.white_url,
      gray_url: parsed.gray_url,
      black_url: parsed.black_url,
      require_click_id: parsed.require_click_id,
      block_datacenters: parsed.block_datacenters,
      block_unknown_user_agents: parsed.block_unknown_user_agents,
      active: true,
    });

    if (error) {
      if (error.code === "23505" || error.message?.includes("unique")) {
        if (error.message?.includes("custom_domain") || error.details?.includes("custom_domain")) {
          return { error: "Este domínio próprio já está cadastrado em outro link blindado." };
        }
        return { error: "Este slug já está em uso por outro link blindado. Escolha um slug diferente." };
      }
      throw error;
    }

    revalidatePath("/painel/shield");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    return {
      error: msg || "Não foi possível criar o link blindado. Confira os campos digitados.",
    };
  }
}

export async function updateShield(
  workspace: string,
  id: string,
  form: FormData,
): Promise<ActionResult> {
  try {
    const { client } = await authorize(workspace, true);
    z.string().uuid().parse(id);

    const parsed = z
      .object({
        name: z.string().trim().min(2).max(100),
        offer_id: z.string().uuid(),
        slug: z
          .string()
          .trim()
          .toLowerCase()
          .regex(
            /^[a-z0-9\-_]{3,64}$/,
            "O slug deve ter entre 3 e 64 caracteres.",
          ),
        custom_domain: z
          .string()
          .trim()
          .toLowerCase()
          .regex(
            /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/,
            "Domínio inválido. Use um formato como: oferta.meusite.com",
          )
          .optional()
          .or(z.literal("")),
        white_url: webUrl,
        gray_url: webUrl,
        black_url: webUrl,
        require_click_id: z.preprocess((v) => v === "true" || v === "on" || v === true, z.boolean()),
        block_datacenters: z.preprocess((v) => v === "true" || v === "on" || v === true, z.boolean()),
        block_unknown_user_agents: z.preprocess((v) => v === "true" || v === "on" || v === true, z.boolean()),
      })
      .parse(Object.fromEntries(form));

    const { error } = await client
      .from("utm_shields")
      .update({
        name: parsed.name,
        offer_id: parsed.offer_id,
        slug: parsed.slug,
        custom_domain: parsed.custom_domain ? parsed.custom_domain : null,
        white_url: parsed.white_url,
        gray_url: parsed.gray_url,
        black_url: parsed.black_url,
        require_click_id: parsed.require_click_id,
        block_datacenters: parsed.block_datacenters,
        block_unknown_user_agents: parsed.block_unknown_user_agents,
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", workspace)
      .eq("id", id);

    if (error) {
      if (error.code === "23505" || error.message?.includes("unique")) {
        if (error.message?.includes("custom_domain") || error.details?.includes("custom_domain")) {
          return { error: "Este domínio próprio já está cadastrado em outro link blindado." };
        }
        return { error: "Este slug já está em uso. Escolha um slug diferente." };
      }
      throw error;
    }

    revalidatePath("/painel/shield");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    return {
      error: msg || "Não foi possível atualizar o link blindado.",
    };
  }
}

export async function toggleShield(
  workspace: string,
  id: string,
  active: boolean,
): Promise<ActionResult> {
  try {
    const { client } = await authorize(workspace, true);
    z.string().uuid().parse(id);

    const { error } = await client
      .from("utm_shields")
      .update({ active, updated_at: new Date().toISOString() })
      .eq("workspace_id", workspace)
      .eq("id", id);

    if (error) throw error;
    revalidatePath("/painel/shield");
    return { ok: true };
  } catch {
    return { error: "Não foi possível alterar o status do link blindado." };
  }
}

export async function deleteShield(
  workspace: string,
  id: string,
): Promise<ActionResult> {
  try {
    const { client } = await authorize(workspace, true);
    z.string().uuid().parse(id);

    const { error } = await client
      .from("utm_shields")
      .delete()
      .eq("workspace_id", workspace)
      .eq("id", id);

    if (error) throw error;
    revalidatePath("/painel/shield");
    return { ok: true };
  } catch {
    return { error: "Não foi possível excluir o link blindado." };
  }
}

export async function createMcpApiKeyAction(
  workspace: string,
  name: string = "Claude / Codex MCP",
): Promise<{ ok?: boolean; error?: string; rawKey?: string; keyInfo?: unknown }> {
  try {
    const { user } = await requireFeature(workspace, "mcp", true);
    const result = await createKeyRecord(workspace, user.id, name);
    revalidatePath("/painel");
    return { ok: true, rawKey: result.rawKey, keyInfo: result };
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : "";
    if (/utm_api_keys|schema cache|relation .* does not exist/i.test(detail)) {
      return {
        error:
          "A estrutura de chaves MCP ainda não foi aplicada neste projeto Supabase. Execute a migration 20260909160000_mcp_api_keys.sql e tente novamente.",
      };
    }
    return { error: detail || "Não foi possível gerar a chave MCP." };
  }
}

export async function listMcpApiKeysAction(workspace: string) {
  try {
    await requireFeature(workspace, "mcp", false);
    const keys = await listKeyRecords(workspace);
    return { ok: true, keys };
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : "";
    if (/utm_api_keys|schema cache|relation .* does not exist/i.test(detail)) {
      return {
        error:
          "A estrutura de chaves MCP ainda não foi aplicada neste projeto Supabase. Execute a migration 20260909160000_mcp_api_keys.sql e tente novamente.",
        keys: [],
      };
    }
    return { error: detail || "Não foi possível listar as chaves.", keys: [] };
  }
}

export async function revokeMcpApiKeyAction(workspace: string, keyId: string): Promise<ActionResult> {
  try {
    await authorize(workspace, true);
    z.string().uuid().parse(keyId);
    const success = await revokeKeyRecord(workspace, keyId);
    if (!success) throw new Error();
    revalidatePath("/painel");
    return { ok: true };
  } catch {
    return { error: "Não foi possível revogar esta chave." };
  }
}

// ---------------------------------------------------------------------------
// Conta do usuário: senha, 2FA e colaboradores do workspace
// ---------------------------------------------------------------------------

export async function updateAccountPassword(form: FormData): Promise<ActionResult> {
  try {
    const schema = z
      .object({
        currentPassword: z.string().min(1),
        newPassword: z
          .string()
          .min(8)
          .max(128)
          .regex(/[A-Z]/, "precisa de maiúscula")
          .regex(/[0-9]/, "precisa de número")
          .regex(/[^A-Za-z0-9]/, "precisa de caractere especial"),
      })
      .safeParse(Object.fromEntries(form));
    if (!schema.success) return { error: "Verifique os requisitos da nova senha." };
    const client = await db();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user?.email) return { error: "Sessão inválida." };
    if (!(await rateLimit(`pwd-change:${user.id}`, 5)))
      return { error: "Muitas tentativas. Aguarde um minuto." };
    const { error: reauthError } = await client.auth.signInWithPassword({
      email: user.email,
      password: schema.data.currentPassword,
    });
    if (reauthError) return { error: "Senha atual incorreta." };
    const { error } = await client.auth.updateUser({ password: schema.data.newPassword });
    if (error) return { error: "Não foi possível atualizar a senha." };
    return { ok: true };
  } catch (e) {
    console.error("Account password update failed", { message: e instanceof Error ? e.message : "unknown" });
    return { error: "Não foi possível atualizar a senha." };
  }
}

type MfaActionResult = { ok?: boolean; error?: string; factorId?: string; qrCode?: string; secret?: string };

export async function mfaListFactors(): Promise<MfaActionResult & { enrolled?: boolean }> {
  try {
    const client = await db();
    const { data, error } = await client.auth.mfa.listFactors();
    if (error) return { error: error.message };
    const verified = data.totp.find((f) => f.status === "verified");
    return { ok: true, enrolled: Boolean(verified), factorId: verified?.id };
  } catch (e) {
    console.error("mfaListFactors failed", { message: e instanceof Error ? e.message : "unknown" });
    return { error: "Não foi possível carregar o status do 2FA." };
  }
}

export async function mfaEnroll(): Promise<MfaActionResult> {
  try {
    const client = await db();
    const { data, error } = await client.auth.mfa.enroll({ factorType: "totp" });
    if (error) return { error: "Não foi possível iniciar o 2FA." };
    return { ok: true, factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
  } catch (e) {
    console.error("mfaEnroll failed", { message: e instanceof Error ? e.message : "unknown" });
    return { error: "Não foi possível iniciar o 2FA." };
  }
}

export async function mfaVerify(factorId: string, code: string): Promise<MfaActionResult> {
  try {
    const client = await db();
    const { data: challenge, error: chErr } = await client.auth.mfa.challenge({ factorId });
    if (chErr) return { error: "Não foi possível validar o código." };
    const { error } = await client.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
    if (error) return { error: "Código inválido." };
    revalidatePath("/painel");
    return { ok: true };
  } catch (e) {
    console.error("mfaVerify failed", { message: e instanceof Error ? e.message : "unknown" });
    return { error: "Não foi possível validar o código." };
  }
}

export async function mfaUnenroll(factorId: string): Promise<MfaActionResult> {
  try {
    const client = await db();
    const { error } = await client.auth.mfa.unenroll({ factorId });
    if (error) return { error: "Não foi possível desativar o 2FA." };
    revalidatePath("/painel");
    return { ok: true };
  } catch (e) {
    console.error("mfaUnenroll failed", { message: e instanceof Error ? e.message : "unknown" });
    return { error: "Não foi possível desativar o 2FA." };
  }
}

export async function inviteMember(workspace: string, form: FormData): Promise<ActionResult> {
  try {
    const { role } = await requireFeature(workspace, "agency", true);
    if (role !== "owner") return { error: "Apenas o proprietário pode convidar colaboradores." };
    const email = z.string().email().safeParse(form.get("email"));
    if (!email.success) return { error: "Informe um e-mail válido." };
    const service = admin();
    const { data: usersData, error: listError } = await service.auth.admin.listUsers({ perPage: 1000 });
    if (listError) throw listError;
    const found = usersData?.users.find((u) => u.email?.toLowerCase() === email.data.toLowerCase());
    if (!found)
      return { error: "Esse e-mail ainda não tem conta no Trackbase. Peça para a pessoa se cadastrar primeiro." };
    const { error } = await service
      .from("utm_members")
      .upsert({ workspace_id: workspace, user_id: found.id, role: "member" }, { onConflict: "workspace_id,user_id" });
    if (error) throw error;
    revalidatePath("/painel");
    return { ok: true };
  } catch (e) {
    console.error("Invite member failed", { message: e instanceof Error ? e.message : "unknown" });
    return { error: "Não foi possível convidar este colaborador." };
  }
}

export async function removeMember(workspace: string, userId: string): Promise<ActionResult> {
  try {
    const { role } = await authorize(workspace, true);
    if (role !== "owner") return { error: "Apenas o proprietário pode remover colaboradores." };
    const { error } = await admin()
      .from("utm_members")
      .delete()
      .eq("workspace_id", workspace)
      .eq("user_id", userId)
      .neq("role", "owner");
    if (error) throw error;
    revalidatePath("/painel");
    return { ok: true };
  } catch (e) {
    console.error("Remove member failed", { message: e instanceof Error ? e.message : "unknown" });
    return { error: "Não foi possível remover este colaborador." };
  }
}

export async function listMembersWithEmail(
  workspace: string,
): Promise<{ ok?: boolean; error?: string; members?: Array<{ userId: string; email: string; role: string }> }> {
  try {
    await authorize(workspace);
    const service = admin();
    const { data: members, error } = await service
      .from("utm_members")
      .select("user_id, role")
      .eq("workspace_id", workspace);
    if (error) throw error;
    const { data: usersData, error: listError } = await service.auth.admin.listUsers({ perPage: 1000 });
    if (listError) throw listError;
    const byId = new Map(usersData.users.map((u) => [u.id, u.email ?? ""]));
    return {
      ok: true,
      members: (members ?? []).map((m) => ({ userId: m.user_id, email: byId.get(m.user_id) ?? "—", role: m.role })),
    };
  } catch (e) {
    console.error("List members failed", { message: e instanceof Error ? e.message : "unknown" });
    return { error: "Não foi possível carregar os colaboradores." };
  }
}

