import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase/server";
import { evaluateShieldRequest } from "@/lib/shield/engine";
import { ShieldRecord, ShieldRequestContext } from "@/lib/shield/types";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  if (!slug) {
    return new NextResponse("Link não encontrado", { status: 404 });
  }

  // 1. Busca configuração do Shield no banco pelo slug OU pelo domínio próprio.
  // Duas consultas separadas por igualdade em vez de intercalar o slug bruto
  // (vindo direto do path público, sem validação de formato) dentro de um
  // filtro .or() — um valor com vírgula/parêntese quebraria a sintaxe do
  // filtro do PostgREST e poderia casar com uma linha diferente da intencionada.
  const service = admin();
  const bySlug = await service
    .from("utm_shields")
    .select("*, utm_offers(public_key)")
    .eq("slug", slug)
    .maybeSingle();
  const shieldData =
    bySlug.data ??
    (
      await service
        .from("utm_shields")
        .select("*, utm_offers(public_key)")
        .eq("custom_domain", slug)
        .maybeSingle()
    ).data;

  if (!shieldData) {
    return new NextResponse("Página não encontrada ou desativada", { status: 404 });
  }

  const shield = shieldData as unknown as ShieldRecord;
  const offerPublicKey = (shieldData as unknown as { utm_offers?: { public_key?: string } })
    ?.utm_offers?.public_key;

  // 2. Extrai dados da requisição
  const clientIp =
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "127.0.0.1";

  const userAgent = request.headers.get("user-agent") || "";
  const referer = request.headers.get("referer") || "";
  const urlObj = new URL(request.url);
  const queryParams = Object.fromEntries(urlObj.searchParams.entries());

  // Extrai cookie de sessão existente
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(/tb_shield_session=([^;]+)/);
  const sessionCookie = match ? match[1] : null;

  const ctx: ShieldRequestContext = {
    ip: clientIp,
    userAgent,
    referer,
    queryParams,
    sessionCookie,
  };

  // 3. Executa o motor de decisão do Shield
  const evaluation = evaluateShieldRequest(shield, ctx);

  // 4. Grava log analítico de forma assíncrona (não trava a resposta)
  void (async () => {
    try {
      await service.from("utm_shield_logs").insert({
        shield_id: shield.id,
        workspace_id: shield.workspace_id,
        verdict: evaluation.verdict,
        reason: evaluation.reason,
        ip_masked: evaluation.ipMasked,
        is_datacenter: evaluation.isDatacenter,
        user_agent: userAgent.slice(0, 300),
        referer: referer.slice(0, 300),
      });
    } catch (e) {
      console.error("Falha ao registrar log de shield:", e);
    }
  })();

  // 5. Zero-Redirect: Faz o Reverse Proxy buscando o HTML da variante selecionada
  try {
    const targetUrl = new URL(evaluation.targetUrl);
    // Preserva parâmetros de query na URL de destino (como UTMs e fbclid)
    for (const [key, value] of Object.entries(queryParams)) {
      if (!targetUrl.searchParams.has(key)) {
        targetUrl.searchParams.set(key, value);
      }
    }

    const fetched = await fetch(targetUrl.href, {
      headers: {
        "User-Agent": userAgent,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": request.headers.get("accept-language") || "pt-BR,pt;q=0.9,en-US;q=0.8",
      },
      redirect: "follow",
    });

    if (!fetched.ok) {
      return new NextResponse(
        `Erro ao carregar página de destino (Status: ${fetched.status})`,
        { status: 502 },
      );
    }

    let html = await fetched.text();

    // Injeta a tag <base href="..."> para garantir que caminhos relativos (imagens, css, js)
    // resolvam para o domínio de origem da página de vendas original sem quebrar layout
    const baseHref = `${targetUrl.origin}/`;
    if (html.includes("<head>")) {
      html = html.replace("<head>", `<head><base href="${baseHref}">`);
    } else if (html.includes("<head ")) {
      html = html.replace(/<head\b[^>]*>/, `$&<base href="${baseHref}">`);
    }

    // Auto-injeção do Tracker.js do Trackbase: ativa automaticamente o Radar de Leads (scroll depth 25/50/75/90%),
    // gravação de sessão e CAPI no checkout mesmo sem o usuário precisar colar script no site dele!
    const appUrl = process.env.APP_URL || "";
    if (offerPublicKey && evaluation.verdict === "black") {
      const trackerScript = `<script src="${appUrl}/tracker.js" data-key="${offerPublicKey}" defer></script>`;
      if (html.includes("</head>")) {
        html = html.replace("</head>", `${trackerScript}</head>`);
      } else if (html.includes("</body>")) {
        html = html.replace("</body>", `${trackerScript}</body>`);
      }
    }

    const headers = new Headers();
    headers.set("Content-Type", "text/html; charset=utf-8");
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    headers.set("X-Shield-Verdict", evaluation.verdict);

    // Se um novo token de sessão de lead qualificado foi gerado, anexa o cookie
    if (evaluation.sessionTokenToSet) {
      headers.set(
        "Set-Cookie",
        `tb_shield_session=${evaluation.sessionTokenToSet}; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax; Secure`,
      );
    }

    return new NextResponse(html, {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error("Erro no proxy do Shield:", err);
    return new NextResponse("Falha de conexão com a página de destino.", { status: 502 });
  }
}
