"use server";
import { requireFeature } from "@/lib/feature-access";
import { db, admin } from "@/lib/supabase/server";
import { authorize, digest, rateLimit, encrypt } from "@/lib/security";
import { listGatewayProducts, type CatalogProvider } from "@/lib/gateway-catalog";
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
export async function requestPasswordReset(form: FormData): Promise<ActionResult> {
  const email = z.string().email().safeParse(form.get("email"));
  if (!email.success) return { error: "Informe um e-mail válido." };
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
  const email = z.string().email().safeParse(form.get("email")),
    phone = z
      .string()
      .trim()
      .regex(/^\+?[0-9\s().-]{10,20}$/)
      .safeParse(form.get("phone")),
    password = z.string().min(10).max(128).safeParse(form.get("password"));
  if (!email.success || !phone.success || !password.success)
    return {
      error: "Use um e-mail válido, celular válido e senha com pelo menos 10 caracteres.",
    };
  const client = await db();
  const { error } = await client.auth.signUp({
    email: email.data,
    password: password.data,
    options: {
      emailRedirectTo: `${process.env.APP_URL}/auth/callback`,
      data: { phone: phone.data },
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
        landing_url: webUrl,
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
        percent_fee: z.coerce.number().min(0).max(100).optional().default(0),
        fixed_fee: z.coerce.number().min(0).optional().default(0),
        cost_per_sale: z.coerce.number().min(0).optional().default(0),
        platform: z
          .enum([
            "hotmart",
            "kiwify",
            "cakto",
            "kirvano",
            "eduzz",
            "monetizze",
            "wiapy",
          ])
          .optional()
          .or(z.literal("")),
        checkout_url: webUrl.optional().or(z.literal("")),
      })
      .parse(raw);

    const { error } = await client.from("utm_offers").insert({
      workspace_id: workspace,
      name: value.name,
      landing_url: value.landing_url,
      currency: value.currency,
      product_type: value.product_type,
      parent_offer_id: value.parent_offer_id ? value.parent_offer_id : null,
      external_product_id: value.external_product_id || null,
      external_offer_id: value.external_offer_id || null,
      percent_fee: value.percent_fee,
      fixed_fee: value.fixed_fee,
      cost_per_sale: value.cost_per_sale,
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
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Limite de ofertas")) {
      return { error: "Limite de ofertas atingido para o plano deste workspace." };
    }
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
        ]),
        offer_id: z.string().uuid(),
        external_product_id: z.string().trim().min(1).max(200),
        external_offer_id: z.string().trim().max(200),
        currency: z.string().regex(/^[A-Z]{3}$/),
        secret: z.string().min(4).max(500),
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
        name: `${value.provider.toUpperCase()} · ${offer.name}`,
        external_product_id: value.external_product_id,
        external_offer_id: value.external_offer_id || null,
        currency: value.currency,
      })
      .select("id")
      .single();
    if (error) {
      if (error.message?.includes("Limite de integrações")) {
        return { error: "Limite de integrações atingido para o plano deste workspace." };
      }
      throw error;
    }
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
    if (value.provider !== "cakto" && (!value.webhook_secret || value.webhook_secret.length < 4)) {
      return { error: "Informe o segredo do webhook antes de conectar este gateway." };
    }

    const credentials = {
      clientId: value.client_id,
      clientSecret: value.client_secret,
      accountId: value.account_id || undefined,
      basicToken: value.basic_token || undefined,
    };
    const products = await listGatewayProducts(value.provider as CatalogProvider, credentials);
    const product = products.find((item) => item.externalProductId === value.external_product_id);
    if (!product) return { error: "O produto selecionado não está mais disponível. Busque novamente." };

    const service = admin();
    const landingUrl = product.checkoutUrl || {
      hotmart: "https://hotmart.com",
      kiwify: "https://kiwify.com.br",
      cakto: "https://cakto.com.br",
    }[value.provider];
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
      })
      .select("id")
      .single();
    if (integrationError || !integration) {
      await service.from("utm_offers").delete().eq("id", offer.id).eq("workspace_id", workspace);
      throw integrationError || new Error("Não foi possível criar a integração.");
    }

    const { error: credentialError } = await service.from("utm_credentials").insert({
      workspace_id: workspace,
      integration_id: integration.id,
      webhook_hash: value.webhook_secret ? digest(value.webhook_secret) : null,
      api_credentials_ciphertext: encrypt(JSON.stringify(credentials)),
    });
    if (credentialError) {
      await service.from("utm_integrations").delete().eq("id", integration.id).eq("workspace_id", workspace);
      await service.from("utm_offers").delete().eq("id", offer.id).eq("workspace_id", workspace);
      throw credentialError;
    }
    revalidatePath("/painel");
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Limite")) return { error: message };
    return { error: "Não foi possível importar o produto. Confira as chaves, o produto e as permissões da API." };
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
    const { error } = await admin()
      .from("utm_credentials")
      .update({ webhook_hash: digest(value.secret) })
      .eq("workspace_id", workspace)
      .eq("integration_id", value.integration);
    if (error) throw error;
    revalidatePath("/painel");
    return { ok: true };
  } catch {
    return { error: "Não foi possível salvar o secret do webhook." };
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

export async function cloneFunnelAction(
  workspace: string,
  url: string,
): Promise<{ ok?: boolean; error?: string; structure?: unknown }> {
  try {
    await authorize(workspace, true);
    const { analyzeAndClonePage } = await import("@/lib/funnel-cloner");
    return await analyzeAndClonePage(url);
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Falha ao analisar a URL." };
  }
}

export async function saveFunnelAction(
  workspace: string,
  data: {
    id?: string;
    offer_id?: string | null;
    name: string;
    source_url?: string;
    blocks: unknown[];
    pixels?: unknown[];
    settings?: Record<string, unknown>;
    status?: "draft" | "published" | "archived";
  },
): Promise<{ ok?: boolean; error?: string; id?: string }> {
  try {
    const { client } = await authorize(workspace, true);
    if (!data.name || data.name.trim().length < 2) {
      return { error: "Nome do funil deve ter pelo menos 2 caracteres." };
    }

    if (data.id) {
      const { data: updated, error } = await client
        .from("utm_funnels")
        .update({
          name: data.name.trim(),
          offer_id: data.offer_id || null,
          blocks: data.blocks || [],
          pixels: data.pixels || [],
          settings: data.settings || {},
          status: data.status || "draft",
          updated_at: new Date().toISOString(),
        })
        .eq("workspace_id", workspace)
        .eq("id", data.id)
        .select("id")
        .single();

      if (error) throw error;
      revalidatePath("/painel");
      return { ok: true, id: updated.id };
    }

    const { data: created, error } = await client
      .from("utm_funnels")
      .insert({
        workspace_id: workspace,
        offer_id: data.offer_id || null,
        name: data.name.trim(),
        source_url: data.source_url || null,
        blocks: data.blocks || [],
        pixels: data.pixels || [],
        settings: data.settings || {},
        status: data.status || "draft",
      })
      .select("id")
      .single();

    if (error) throw error;
    revalidatePath("/painel");
    return { ok: true, id: created.id };
  } catch {
    return { error: "Não foi possível salvar o funil no workspace." };
  }
}

export async function duplicateFunnelAction(
  workspace: string,
  funnelId: string,
): Promise<ActionResult> {
  try {
    const { client } = await authorize(workspace, true);
    const { data: orig, error: findError } = await client
      .from("utm_funnels")
      .select("*")
      .eq("workspace_id", workspace)
      .eq("id", funnelId)
      .single();

    if (findError || !orig) throw new Error("Funil não encontrado.");

    const { error: insError } = await client.from("utm_funnels").insert({
      workspace_id: workspace,
      offer_id: orig.offer_id,
      name: `${orig.name} (Cópia)`,
      source_url: orig.source_url,
      blocks: orig.blocks,
      pixels: orig.pixels,
      settings: orig.settings,
      status: "draft",
    });

    if (insError) throw insError;
    revalidatePath("/painel");
    return { ok: true };
  } catch {
    return { error: "Não foi possível duplicar o funil." };
  }
}

export async function deleteFunnelAction(
  workspace: string,
  funnelId: string,
): Promise<ActionResult> {
  try {
    const { client } = await authorize(workspace, true);
    const { error } = await client
      .from("utm_funnels")
      .delete()
      .eq("workspace_id", workspace)
      .eq("id", funnelId);

    if (error) throw error;
    revalidatePath("/painel");
    return { ok: true };
  } catch {
    return { error: "Não foi possível excluir o funil." };
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
): Promise<ActionResult & { count?: number }> {
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

    return { ok: true, count: result?.count ?? 1 };
  } catch (err) {
    console.error("sendTestPushAction error:", err);
    return { error: "Não foi possível disparar o teste de notificação." };
  }
}


