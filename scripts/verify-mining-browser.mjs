// Optional browser harness. Uses an already installed Playwright supplied via
// PLAYWRIGHT_MODULE and an isolated Chrome started with agent-browser/CDP.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { build } = require("esbuild");
const workspace = "00000000-0000-4000-8000-000000000001";
const offer = {
  id: "00000000-0000-4000-8000-000000000002",
  workspace_id: workspace,
  library_id: "123456789",
  advertiser: "Anunciante de teste",
  library_url: "https://www.facebook.com/ads/library/?id=123456789",
  niche: "Educação",
  tags: ["teste"],
  notes: "",
  status: "saved",
  days_active: 30,
  created_at: "2026-01-01T00:00:00Z",
  captured_at: "2026-01-01T00:00:00Z",
  capture: {
    library_id: "123456789",
    advertiser: "Anunciante de teste",
    page_name: "Página de teste",
    page_id: "55555",
    copy: "<script>window.injected = true</script> Texto de anúncio de teste.",
    headline: "Aprenda algo novo",
    platforms: ["Facebook"],
    media: [],
    activity: "active",
    start_date: "2025-12-01",
    format: "image",
    days_active: 30,
    related_count: 2,
    landing_url: "https://example.com",
  },
};
const monitor = {
  id: "00000000-0000-4000-8000-000000000003",
  workspace_id: workspace,
  offer_id: offer.id,
  page_id: null,
  label: offer.advertiser,
  status: "active",
  execution_status: "awaiting_capture",
  next_check_at: null,
  last_checked_at: null,
  last_error: null,
};
const built = await build({
  stdin: {
    contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {MiningView} from './src/components/mining-view';createRoot(document.getElementById('root')).render(<MiningView workspace="${workspace}"/>);`,
    resolveDir: process.cwd(),
    loader: "tsx",
  },
  bundle: true,
  write: false,
  outfile: join(tmpdir(), "mining-ui.js"),
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"' },
});
const js = built.outputFiles.find((f) => f.path.endsWith(".js")).text,
  css = built.outputFiles.find((f) => f.path.endsWith(".css")).text;
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/bundle.js") {
    res.setHeader("Content-Type", "application/javascript");
    res.end(js);
    return;
  }
  if (url.pathname === "/bundle.css") {
    res.setHeader("Content-Type", "text/css");
    res.end(css);
    return;
  }
  if (!url.pathname.startsWith("/api/mining/")) {
    res.setHeader("Content-Type", "text/html");
    res.end(
      '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><link rel="stylesheet" href="/bundle.css"><style>body{font:16px system-ui;background:#f8faf9;padding:24px;color:#172321}.button{padding:10px;border:1px solid #ccc;border-radius:8px;background:#137b54;color:white}.secondary{background:white;color:#172321}</style></head><body><h1>Mineração — dados de teste</h1><div id="root"></div><script src="/bundle.js"></script></body></html>',
    );
    return;
  }
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};
  res.setHeader("Content-Type", "application/json");
  if (url.searchParams.get("q") === "falha") {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: "Falha simulada" }));
    return;
  }
  if (url.pathname.endsWith("/extension")) {
    res.end(JSON.stringify({ grants: [] }));
    return;
  }
  if (url.pathname.endsWith("/history")) {
    res.end(
      JSON.stringify({
        snapshots: [],
        changes: [],
        analyses: [],
        runs: [],
        count: 0,
      }),
    );
    return;
  }
  if (url.pathname.endsWith("/monitors")) {
    if (req.method === "PATCH") monitor.status = body.status;
    res.end(JSON.stringify({ monitors: [monitor], monitor }));
    return;
  }
  if (url.pathname.endsWith(`/${offer.id}`)) {
    Object.assign(offer, body);
    res.end(JSON.stringify({ offer }));
    return;
  }
  res.end(
    JSON.stringify({
      offers: url.searchParams.get("q") === "vazio" ? [] : [offer],
      count: 1,
    }),
  );
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await chromium.connectOverCDP(process.env.CDP_URL);
try {
  const page = await browser.contexts()[0].newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByRole("button", { name: "Ver oferta", exact: true }).click();
  await page.getByRole("heading", { name: "Análise de IA" }).waitFor();
  assert.equal(await page.evaluate(() => window.injected), undefined);
  await page.getByRole("button", { name: "Fechar detalhes" }).click();
  await page.getByLabel("Buscar", { exact: true }).fill("vazio");
  await page
    .getByRole("heading", { name: "Nenhuma oferta encontrada" })
    .waitFor();
  await page.getByLabel("Buscar", { exact: true }).fill("falha");
  await page.getByRole("alert").filter({ hasText: "Falha simulada" }).waitFor();
  await page.getByLabel("Buscar", { exact: true }).fill("");
  await page.getByRole("button", { name: "Ver oferta", exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Monitoramento", exact: true })
    .click();
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await page.getByText("Monitoramento pausado", { exact: false }).waitFor();
  await page.getByRole("button", { name: "Ativar", exact: true }).click();
  await page.getByRole("button", { name: "Pausar", exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: join(tmpdir(), "trackbase-mining-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Configurar extensão" }).click();
  await page.getByText("Sem autorização ativa da extensão.").waitFor();
  assert.deepEqual(errors, []);
  // Real Chrome content script, using a controlled HTML response at a matching URL.
  const meta = await browser.contexts()[0].newPage();
  await meta.route("https://www.facebook.com/ads/library/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<html><head><meta charset="utf-8"></head><body><article><a href="https://www.facebook.com/profile.php?id=55555">Anunciante de teste</a><div>ID da biblioteca: 123456789</div><div>Ativo</div><div dir="auto">Conheça a oferta</div><div><button>Ver detalhes do anúncio</button></div></article></body></html>',
    }),
  );
  await meta.goto("https://www.facebook.com/ads/library/?id=123456789");
  await meta
    .getByRole("button", { name: "Salvar no Trackbase", exact: true })
    .waitFor();
  await meta
    .getByRole("button", { name: "Salvar no Trackbase", exact: true })
    .click();
  await meta
    .getByRole("status")
    .filter({ hasText: "vincule um workspace" })
    .waitFor();
  await meta.evaluate(() => {
    const article = document.querySelector("article").cloneNode(true);
    article.querySelector("[data-trackbase-controls]").remove();
    article.innerHTML = article.innerHTML.replace("123456789", "987654321");
    document.body.append(article);
  });
  await meta.waitForFunction(
    () => document.querySelectorAll("[data-trackbase-controls]").length === 2,
  );
  assert.equal(
    await meta
      .getByRole("button", { name: "Salvar no Trackbase", exact: true })
      .count(),
    2,
  );
  await meta.screenshot({
    path: join(tmpdir(), "trackbase-mining-capture.png"),
    fullPage: true,
  });
  console.log(
    "PASS: real React UI (empty/error/details/XSS/pause/resume/mobile), loaded Chrome extension, missing credentials and dynamic DOM capture. All data mocked.",
  );
  console.log(`Screenshots: ${tmpdir()}`);
  await page.close();
  await meta.close();
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
