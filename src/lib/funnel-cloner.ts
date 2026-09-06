import { isAllowedCheckout } from "./tracker";

export type FunnelBlockType =
  | "hero"
  | "vsl"
  | "benefits"
  | "testimonials"
  | "offer"
  | "faq"
  | "footer";

export type FunnelBlock = {
  id: string;
  type: FunnelBlockType;
  title: string;
  subtitle?: string;
  badge?: string;
  content?: string;
  ctaText?: string;
  ctaUrl?: string;
  imageUrl?: string;
  videoUrl?: string;
  items?: {
    id: string;
    title?: string;
    text?: string;
    author?: string;
    role?: string;
  }[];
  style?: {
    bg?: string;
    textColor?: string;
    accentColor?: string;
  };
};

export type DetectedPixel = {
  type: "meta" | "google_analytics" | "gtm" | "tiktok";
  id: string;
};

export type ClonedFunnelStructure = {
  sourceUrl: string;
  title: string;
  description?: string;
  blocks: FunnelBlock[];
  pixels: DetectedPixel[];
  detectedCheckouts: string[];
  extractedAt: string;
};

// Validação estrita de SSRF para URLs externas
export function validateUrlForCloning(rawUrl: string): { ok: boolean; error?: string; url?: URL } {
  try {
    const trimmed = rawUrl.trim();
    if (!trimmed) return { ok: false, error: "A URL da página não pode estar vazia." };
    const parsed = new URL(trimmed);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { ok: false, error: "Apenas protocolos HTTP e HTTPS são aceitos." };
    }

    const host = parsed.hostname.toLowerCase();
    // Bloqueia IPs locais, de rede interna e metadados de nuvem (prevenção SSRF)
    const isPrivate =
      host === "localhost" ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
      host === "169.254.169.254" || // AWS/GCP/Azure metadata
      host === "::1" ||
      host === "0.0.0.0";

    if (isPrivate) {
      return { ok: false, error: "Endereços privados ou locais não são permitidos por segurança." };
    }

    return { ok: true, url: parsed };
  } catch {
    return { ok: false, error: "URL inválida ou mal formatada." };
  }
}

// Extrai pixels conhecidos de um HTML
export function extractPixels(html: string): DetectedPixel[] {
  const pixels: DetectedPixel[] = [];
  const seen = new Set<string>();

  // Meta Pixel ID
  const metaRegex = /(?:fbq\s*\(\s*['"]init['"]\s*,\s*['"]([0-9]+)['"]|id=([0-9]{10,20})&ev=)/g;
  let match;
  while ((match = metaRegex.exec(html)) !== null) {
    const id = match[1] || match[2];
    if (id && !seen.has(`meta_${id}`)) {
      seen.add(`meta_${id}`);
      pixels.push({ type: "meta", id });
    }
  }

  // Google Analytics (G-XXXXX ou UA-XXXXX)
  const gaRegex = /['"](G-[A-Z0-9]{6,14}|UA-[0-9]{4,10}-[0-9]{1,4})['"]/g;
  while ((match = gaRegex.exec(html)) !== null) {
    const id = match[1];
    if (id && !seen.has(`ga_${id}`)) {
      seen.add(`ga_${id}`);
      pixels.push({ type: "google_analytics", id });
    }
  }

  // GTM
  const gtmRegex = /['"](GTM-[A-Z0-9]{4,10})['"]/g;
  while ((match = gtmRegex.exec(html)) !== null) {
    const id = match[1];
    if (id && !seen.has(`gtm_${id}`)) {
      seen.add(`gtm_${id}`);
      pixels.push({ type: "gtm", id });
    }
  }

  // TikTok
  const ttRegex = /ttq\.load\s*\(\s*['"]([A-Z0-9]{10,30})['"]\)/g;
  while ((match = ttRegex.exec(html)) !== null) {
    const id = match[1];
    if (id && !seen.has(`tt_${id}`)) {
      seen.add(`tt_${id}`);
      pixels.push({ type: "tiktok", id });
    }
  }

  return pixels;
}

// Extrai links de checkout reconhecidos
export function extractCheckoutLinks(html: string): string[] {
  const checkouts: string[] = [];
  const seen = new Set<string>();
  const linkRegex = /href=["'](https?:\/\/[^"'\s>]+)["']/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const link = match[1];
    if (isAllowedCheckout(link) && !seen.has(link)) {
      seen.add(link);
      checkouts.push(link);
    }
  }
  return checkouts;
}

// Limpa e sanitiza texto simples
function cleanText(text: string): string {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// Parser heurístico para estruturação modular do funil
export function parseHtmlToBlocks(html: string): FunnelBlock[] {
  const blocks: FunnelBlock[] = [];

  // 1. Extração do título e headline principal
  const titleMatch = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
  const pageTitle = titleMatch ? cleanText(titleMatch[1]) : "Oferta Especial";

  const h1Match = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  const mainHeadline = h1Match ? cleanText(h1Match[1]) : pageTitle;

  // Subheadline / parágrafo de introdução
  const pMatch = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(html);
  const mainSubtitle = pMatch
    ? cleanText(pMatch[1]).slice(0, 220)
    : "Descubra o método completo testado e aprovado para escalar seus resultados.";

  // Primeiro CTA (botão ou link destacado)
  const ctaMatch = /<(?:a|button)[^>]*(?:class|id)=["'][^"']*(?:btn|cta|button|comprar|quero|checkout)[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|button)>/i.exec(
    html,
  );
  const firstCtaText = ctaMatch ? cleanText(ctaMatch[1]).slice(0, 60) : "Quero Garantir Minha Vaga";

  const checkouts = extractCheckoutLinks(html);
  const primaryCheckout = checkouts[0] || "https://pay.exemplo.com/checkout";

  // Bloco 1: Hero
  blocks.push({
    id: "hero_1",
    type: "hero",
    badge: "OFERTA EXCLUSIVA",
    title: mainHeadline || "Aprenda a virar o jogo na sua operação",
    subtitle: mainSubtitle,
    ctaText: firstCtaText || "Sim! Quero Acesso Imediato",
    ctaUrl: primaryCheckout,
    style: {
      bg: "#ffffff",
      textColor: "#17152F",
      accentColor: "#5B34EA",
    },
  });

  // Bloco 2: VSL ou Vídeo (se presente)
  const videoMatch = /(?:youtube\.com\/embed\/|vimeo\.com\/|pandavideo|vturb|converteai)[^"'\s>]+/i.exec(
    html,
  );
  if (videoMatch || /<(?:video|iframe)[^>]+>/i.test(html)) {
    blocks.push({
      id: "vsl_1",
      type: "vsl",
      title: "Assista ao vídeo explicativo abaixo:",
      subtitle: "Aperte o play e entenda em poucos minutos como funciona na prática.",
      videoUrl: videoMatch ? `https://${videoMatch[0]}` : "https://www.youtube.com/embed/dQw4w9WgXcQ",
      ctaText: "Continuar após o vídeo",
      ctaUrl: primaryCheckout,
    });
  }

  // Bloco 3: Benefícios / O que você vai receber
  const listItems: { id: string; title: string; text: string }[] = [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let liMatch;
  let count = 1;
  while ((liMatch = liRegex.exec(html)) !== null && count <= 4) {
    const text = cleanText(liMatch[1]);
    if (text.length > 8 && text.length < 160) {
      listItems.push({
        id: `b_${count}`,
        title: `Pilar 0${count}`,
        text,
      });
      count++;
    }
  }

  if (listItems.length === 0) {
    listItems.push(
      { id: "b_1", title: "Acesso Imediato", text: "Receba tudo no seu e-mail logo após a confirmação." },
      { id: "b_2", title: "Passo a Passo Prático", text: "Sem teoria desnecessária. Vá direto para o que dá retorno." },
      { id: "b_3", title: "Suporte e Comunidade", text: "Tire dúvidas e interaja com operadores experientes." },
    );
  }

  blocks.push({
    id: "benefits_1",
    type: "benefits",
    title: "O que você vai receber com esta oferta:",
    subtitle: "Estrutura pronta para você aplicar com segurança e consistência.",
    items: listItems,
  });

  // Bloco 4: Depoimentos / Prova Social
  blocks.push({
    id: "testimonials_1",
    type: "testimonials",
    title: "Quem já aplicou recomenda:",
    subtitle: "Histórias reais de quem transformou seus resultados com este método.",
    items: [
      {
        id: "t_1",
        author: "Rafael M.",
        role: "Gestor de Tráfego",
        text: "“Consegui clareza total dos números da minha operação no primeiro dia. Mudou completamente meu CPA.”",
      },
      {
        id: "t_2",
        author: "Camila S.",
        role: "Infoprodutora",
        text: "“A taxa de conversão da landing subiu consideravelmente e o rastreamento parou de perder vendas.”",
      },
      {
        id: "t_3",
        author: "Lucas B.",
        role: "Afiliado Profissional",
        text: "“Identifiquei exatamente onde os leads abandonavam o checkout. O retorno sobre o investimento foi imediato.”",
      },
    ],
  });

  // Bloco 5: Oferta e Preço
  blocks.push({
    id: "offer_1",
    type: "offer",
    title: "Garanta seu acesso com condição especial",
    subtitle: "Oferta por tempo limitado com garantia incondicional de 7 dias.",
    content: "Aproveite esta condição única antes que as vagas encerrem.",
    ctaText: "QUERO APROVEITAR ESTA CONDIÇÃO AGORA",
    ctaUrl: primaryCheckout,
    style: {
      bg: "#17152F",
      textColor: "#ffffff",
      accentColor: "#10B981",
    },
  });

  // Bloco 6: Perguntas Frequentes (FAQ)
  blocks.push({
    id: "faq_1",
    type: "faq",
    title: "Dúvidas Frequentes",
    subtitle: "Tudo o que você precisa saber antes de dar o próximo passo.",
    items: [
      {
        id: "f_1",
        title: "Como recebo o acesso?",
        text: "Assim que o pagamento for confirmado, os dados de acesso são enviados imediatamente ao seu e-mail.",
      },
      {
        id: "f_2",
        title: "Tem garantia?",
        text: "Sim, você tem 7 dias de garantia incondicional. Se não gostar por qualquer motivo, seu investimento é 100% devolvido.",
      },
      {
        id: "f_3",
        title: "Quais são as formas de pagamento?",
        text: "Cartão de crédito em até 12x, PIX com liberação instantânea ou boleto bancário.",
      },
    ],
  });

  // Bloco 7: Rodapé
  blocks.push({
    id: "footer_1",
    type: "footer",
    title: `${pageTitle} — Todos os direitos reservados.`,
    subtitle: "Este site não possui vínculo oficial com o Facebook ou Meta Inc.",
  });

  return blocks;
}

// Analisador completo de página
export async function analyzeAndClonePage(
  rawUrl: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ ok: boolean; error?: string; structure?: ClonedFunnelStructure }> {
  const validation = validateUrlForCloning(rawUrl);
  if (!validation.ok || !validation.url) {
    return { ok: false, error: validation.error };
  }

  const targetUrl = validation.url.toString();

  try {
    const response = await fetchFn(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12000), // 12s timeout
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `Não foi possível acessar a página de origem (código HTTP ${response.status}). Verifique se a URL está correta.`,
      };
    }

    const html = await response.text();
    const pixels = extractPixels(html);
    const checkouts = extractCheckoutLinks(html);
    const blocks = parseHtmlToBlocks(html);

    const titleMatch = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
    const title = titleMatch ? cleanText(titleMatch[1]) : "Página Clonada";

    return {
      ok: true,
      structure: {
        sourceUrl: targetUrl,
        title,
        blocks,
        pixels,
        detectedCheckouts: checkouts,
        extractedAt: new Date().toISOString(),
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("aborted") || msg.includes("timeout")) {
      return { ok: false, error: "Tempo esgotado ao tentar ler a página de origem. Verifique a URL." };
    }
    return { ok: false, error: "Falha ao se conectar à URL informada. Verifique se o endereço é público e acessível." };
  }
}

// Gerador de código HTML autônomo e limpo
export function generateAutonomousHtml(structure: ClonedFunnelStructure, appUrl: string, offerKey?: string): string {
  const trackerSnippet = offerKey
    ? `<script src="${appUrl}/tracker.js" data-key="${offerKey}"></script>`
    : `<!-- Trackbase Tracker: configure a chave pública da sua oferta -->`;

  const blocksHtml = structure.blocks
    .map((b) => {
      switch (b.type) {
        case "hero":
          return `
    <section class="block hero-block" style="background:${b.style?.bg || "#ffffff"}; color:${b.style?.textColor || "#17152F"};">
      <div class="container">
        ${b.badge ? `<span class="badge">${b.badge}</span>` : ""}
        <h1>${b.title}</h1>
        ${b.subtitle ? `<p class="subtitle">${b.subtitle}</p>` : ""}
        ${b.ctaUrl ? `<a href="${b.ctaUrl}" class="cta-button" style="background:${b.style?.accentColor || "#5B34EA"}">${b.ctaText || "Comprar Agora"}</a>` : ""}
      </div>
    </section>`;

        case "vsl":
          return `
    <section class="block vsl-block">
      <div class="container">
        <h2>${b.title}</h2>
        ${b.subtitle ? `<p class="subtitle">${b.subtitle}</p>` : ""}
        <div class="video-wrapper">
          <iframe src="${b.videoUrl || ""}" frameborder="0" allowfullscreen></iframe>
        </div>
        ${b.ctaUrl ? `<a href="${b.ctaUrl}" class="cta-button">${b.ctaText || "Continuar"}</a>` : ""}
      </div>
    </section>`;

        case "benefits":
          return `
    <section class="block benefits-block">
      <div class="container">
        <h2>${b.title}</h2>
        ${b.subtitle ? `<p class="subtitle">${b.subtitle}</p>` : ""}
        <div class="benefits-grid">
          ${(b.items || [])
            .map(
              (item) => `
            <div class="benefit-card">
              <h3>${item.title || ""}</h3>
              <p>${item.text || ""}</p>
            </div>`,
            )
            .join("")}
        </div>
      </div>
    </section>`;

        case "testimonials":
          return `
    <section class="block testimonials-block">
      <div class="container">
        <h2>${b.title}</h2>
        ${b.subtitle ? `<p class="subtitle">${b.subtitle}</p>` : ""}
        <div class="testimonials-grid">
          ${(b.items || [])
            .map(
              (t) => `
            <div class="testimonial-card">
              <p class="quote">${t.text || ""}</p>
              <strong>${t.author || ""}</strong>
              <span>${t.role || ""}</span>
            </div>`,
            )
            .join("")}
        </div>
      </div>
    </section>`;

        case "offer":
          return `
    <section class="block offer-block" style="background:${b.style?.bg || "#17152F"}; color:${b.style?.textColor || "#ffffff"};">
      <div class="container">
        <h2>${b.title}</h2>
        ${b.subtitle ? `<p class="subtitle">${b.subtitle}</p>` : ""}
        ${b.content ? `<p class="description">${b.content}</p>` : ""}
        ${b.ctaUrl ? `<a href="${b.ctaUrl}" class="cta-button pulse" style="background:${b.style?.accentColor || "#10B981"}">${b.ctaText || "Garantir Vaga"}</a>` : ""}
      </div>
    </section>`;

        case "faq":
          return `
    <section class="block faq-block">
      <div class="container">
        <h2>${b.title}</h2>
        ${b.subtitle ? `<p class="subtitle">${b.subtitle}</p>` : ""}
        <div class="faq-list">
          ${(b.items || [])
            .map(
              (f) => `
            <div class="faq-item">
              <h3>${f.title || ""}</h3>
              <p>${f.text || ""}</p>
            </div>`,
            )
            .join("")}
        </div>
      </div>
    </section>`;

        case "footer":
          return `
    <footer class="block footer-block">
      <div class="container">
        <p>${b.title}</p>
        <small>${b.subtitle || ""}</small>
      </div>
    </footer>`;

        default:
          return "";
      }
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${structure.title}</title>
  ${trackerSnippet}
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.5; color: #1E293B; background: #FAFAFB; }
    .container { max-width: 960px; margin: 0 auto; padding: 0 1.5rem; text-align: center; }
    .block { padding: 4rem 1rem; }
    h1 { font-size: 2.5rem; line-height: 1.2; margin-bottom: 1rem; font-weight: 800; }
    h2 { font-size: 2rem; margin-bottom: 0.75rem; font-weight: 700; }
    p.subtitle { font-size: 1.15rem; color: #64748B; margin-bottom: 2rem; }
    .badge { display: inline-block; background: #EEF2FF; color: #4F46E5; font-size: 0.75rem; font-weight: 700; padding: 0.35rem 0.8rem; border-radius: 9999px; margin-bottom: 1rem; letter-spacing: 0.05em; }
    .cta-button { display: inline-block; color: #fff; padding: 1rem 2.2rem; font-size: 1.1rem; font-weight: 700; border-radius: 8px; text-decoration: none; box-shadow: 0 4px 14px rgba(0,0,0,0.15); transition: transform 0.2s ease; margin-top: 1rem; }
    .cta-button:hover { transform: scale(1.03); }
    .video-wrapper { position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 800px; margin: 0 auto 2rem; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
    .video-wrapper iframe { position: absolute; top:0; left: 0; width: 100%; height: 100%; }
    .benefits-grid, .testimonials-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.5rem; margin-top: 2rem; text-align: left; }
    .benefit-card, .testimonial-card, .faq-item { background: #fff; padding: 1.5rem; border-radius: 10px; border: 1px solid #E2E8F0; }
    .faq-list { max-width: 720px; margin: 2rem auto 0; text-align: left; display: flex; flex-direction: column; gap: 1rem; }
    .footer-block { background: #0F172A; color: #94A3B8; font-size: 0.85rem; padding: 2.5rem 1rem; }
  </style>
</head>
<body>
  ${blocksHtml}
</body>
</html>`;
}
