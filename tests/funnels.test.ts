import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateUrlForCloning,
  extractPixels,
  extractCheckoutLinks,
  parseHtmlToBlocks,
  analyzeAndClonePage,
  generateAutonomousHtml,
} from "../src/lib/funnel-cloner";
import { runFunnelDiagnostic } from "../src/lib/funnel-diagnostic";

test("Validação de URLs para clonagem rejeita SSRF, protocolos inseguros e IPs locais", () => {
  assert.equal(validateUrlForCloning("").ok, false);
  assert.equal(validateUrlForCloning("javascript:alert(1)").ok, false);
  assert.equal(validateUrlForCloning("file:///etc/passwd").ok, false);
  assert.equal(validateUrlForCloning("http://localhost:3000").ok, false);
  assert.equal(validateUrlForCloning("http://127.0.0.1/admin").ok, false);
  assert.equal(validateUrlForCloning("http://192.168.1.1").ok, false);
  assert.equal(validateUrlForCloning("http://169.254.169.254/latest/meta-data").ok, false);
  assert.equal(validateUrlForCloning("https://suaoferta.com/vsl").ok, true);
});

test("Extração de pixels identifica Meta Pixel, Google Analytics e TikTok", () => {
  const sampleHtml = `
    <html>
      <head>
        <script>
          fbq('init', '987654321012345');
          fbq('track', 'PageView');
          gtag('config', 'G-ABC1234567');
          ttq.load('TT99887766554433');
        </script>
      </head>
      <body><h1>Minha Oferta</h1></body>
    </html>
  `;
  const pixels = extractPixels(sampleHtml);
  assert.equal(pixels.some((p) => p.type === "meta" && p.id === "987654321012345"), true);
  assert.equal(pixels.some((p) => p.type === "google_analytics" && p.id === "G-ABC1234567"), true);
  assert.equal(pixels.some((p) => p.type === "tiktok" && p.id === "TT99887766554433"), true);
});

test("Extração de checkouts encontra links de plataformas conhecidas", () => {
  const html = `
    <div>
      <a href="https://pay.hotmart.com/ABC1234?checkoutMode=10">Hotmart</a>
      <a href="https://pay.kiwify.com.br/xyz890">Kiwify</a>
      <a href="https://ev.eduzz.com/123456">Eduzz</a>
      <a href="https://malicious-site.com/steal">Inseguro</a>
    </div>
  `;
  const checkouts = extractCheckoutLinks(html);
  assert.equal(checkouts.includes("https://pay.hotmart.com/ABC1234?checkoutMode=10"), true);
  assert.equal(checkouts.includes("https://pay.kiwify.com.br/xyz890"), true);
  assert.equal(checkouts.includes("https://ev.eduzz.com/123456"), true);
  assert.equal(checkouts.includes("https://malicious-site.com/steal"), false);
});

test("Parse de HTML gera blocos estruturados e gera HTML autônomo com tracker", () => {
  const sampleHtml = `
    <html>
      <head><title>Método Escala Rápida</title></head>
      <body>
        <h1>Aprenda a Escalar Sem Erros</h1>
        <p>O método definitivo para destravar seus lucros ainda hoje.</p>
        <a href="https://pay.cakto.com.br/prod123" class="btn-comprar">Quero Começar Agora</a>
        <ul>
          <li>Módulo 1: Estrutura Base</li>
          <li>Módulo 2: Otimização de Anúncios</li>
        </ul>
      </body>
    </html>
  `;
  const blocks = parseHtmlToBlocks(sampleHtml);
  assert.equal(blocks.some((b) => b.type === "hero"), true);
  assert.equal(blocks.some((b) => b.type === "benefits"), true);
  assert.equal(blocks.some((b) => b.type === "offer"), true);

  const autonomous = generateAutonomousHtml(
    {
      sourceUrl: "https://oferta.com",
      title: "Método Escala Rápida",
      blocks,
      pixels: [],
      detectedCheckouts: ["https://pay.cakto.com.br/prod123"],
      extractedAt: new Date().toISOString(),
    },
    "https://app.trackbase.com",
    "pub_offer_xyz",
  );

  assert.equal(autonomous.includes('data-key="pub_offer_xyz"'), true);
  assert.equal(autonomous.includes("Aprenda a Escalar Sem Erros"), true);
});

test("Diagnóstico de funil calcula scores e aponta gargalos conforme os dados", () => {
  // Cenário 1: Perda de tráfego entre cliques e PageViews (página lenta)
  const diag1 = runFunnelDiagnostic({
    metaClicks: 100,
    pageviews: 40, // 40% pv rate -> crítico
    ctas: 10,
    checkouts: 2,
    purchases: 0,
    metaSpend: 250,
    grossRevenue: 0,
    refunds: 0,
  });

  assert.equal(
    diag1.bottlenecks.some(
      (b) => b.headline === "Há diferença entre os cliques da Meta e os pageviews registrados.",
    ),
    true,
  );
  assert.equal(diag1.overallScore < 70, true);

  // Cenário 2: Muitos checkouts mas poucas compras (abandono de checkout)
  const diag2 = runFunnelDiagnostic({
    metaClicks: 200,
    pageviews: 180,
    ctas: 80,
    checkouts: 50,
    purchases: 2, // 4% de conversão de checkout -> crítico
    metaSpend: 500,
    grossRevenue: 394,
    refunds: 0,
  });

  assert.equal(
    diag2.bottlenecks.some(
      (b) => b.headline === "O checkout recebe acessos, mas não gera compras.",
    ),
    true,
  );

  // Cenário 3: Operação saudável
  const diag3 = runFunnelDiagnostic({
    metaClicks: 100,
    pageviews: 90,
    ctas: 35,
    checkouts: 20,
    purchases: 8,
    metaSpend: 300,
    grossRevenue: 1200,
    refunds: 0,
    hasCapi: true,
  });

  assert.equal(diag3.overallScore >= 80, true);
  assert.equal(diag3.overallGrade, "A");
  assert.equal(
    diag3.bottlenecks[0]?.headline,
    "Seu funil apresenta conversão saudável entre as etapas.",
  );
});

test("analyzeAndClonePage extrai estrutura com mock de resposta HTTP", async () => {
  const mockFetch = async () =>
    new Response("<html><head><title>Mock Landing</title></head><body><h1>Headline Mock</h1></body></html>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });

  const res = await analyzeAndClonePage("https://oferta-exemplo.com", mockFetch as unknown as typeof fetch);
  assert.equal(res.ok, true);
  assert.equal(res.structure?.title, "Mock Landing");
  assert.equal(res.structure?.blocks.length, 6);
});

