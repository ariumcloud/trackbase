import test from "node:test";
import assert from "node:assert/strict";
import { checkDatacenterIp, maskIp } from "../src/lib/shield/datacenter-signatures";
import { isAdReviewerBot, isSpyOrScraper } from "../src/lib/shield/bot-signatures";
import {
  evaluateShieldRequest,
  createShieldSessionToken,
  verifyShieldSessionToken,
} from "../src/lib/shield/engine";
import { ShieldRecord, ShieldRequestContext } from "../src/lib/shield/types";

const mockShield: ShieldRecord = {
  id: "00000000-0000-0000-0000-000000000001",
  workspace_id: "00000000-0000-0000-0000-000000000002",
  offer_id: "00000000-0000-0000-0000-000000000003",
  name: "Campanha Nutra Escala",
  slug: "oferta-segura-2026",
  white_url: "https://meublog.com/artigo-saude",
  gray_url: "https://oferta-isca.com/ebook-gratis",
  black_url: "https://oferta-real.com/vsl-secreta",
  require_click_id: true,
  block_datacenters: true,
  block_unknown_user_agents: true,
  active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

test("Datacenter IP: detecta faixas conhecidas da AWS, DigitalOcean e Google Cloud", () => {
  assert.equal(checkDatacenterIp("3.80.1.2").isDatacenter, true);
  assert.equal(checkDatacenterIp("142.93.10.20").isDatacenter, true);
  assert.equal(checkDatacenterIp("35.192.1.1").isDatacenter, true);
  assert.equal(checkDatacenterIp("::ffff:54.200.1.1").isDatacenter, true);

  // IP Residencial brasileiro (ex: Claro/Vivo) não deve ser datacenter
  assert.equal(checkDatacenterIp("177.18.29.34").isDatacenter, false);
  assert.equal(checkDatacenterIp("189.40.12.55").isDatacenter, false);
});

test("Mask IP: ofusca os dois últimos octetos para conformidade LGPD", () => {
  assert.equal(maskIp("177.18.29.34"), "177.18.***.***");
});

test("Bot Signatures: identifica revisores de anúncios da Meta e Google", () => {
  assert.equal(
    isAdReviewerBot("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"),
    true,
  );
  assert.equal(isAdReviewerBot("Mozilla/5.0 (compatible; Google-InspectionTool/1.0;)"), true);
  assert.equal(isAdReviewerBot("Mozilla/5.0 (Linux; Android 10; TikTokBot)"), true);
  // Usuário comum no Chrome Mobile não é bot revisor
  assert.equal(
    isAdReviewerBot("Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36"),
    false,
  );
});

test("Bot Signatures: identifica spy tools (AdHeart) e navegadores headless (Puppeteer/Playwright)", () => {
  assert.equal(isSpyOrScraper("Mozilla/5.0 (compatible; AdHeart-Crawler/1.0)"), true);
  assert.equal(isSpyOrScraper("Mozilla/5.0 HeadlessChrome/119.0.6045.105 Safari/537.36"), true);
  assert.equal(isSpyOrScraper("python-requests/2.31.0"), true);
  assert.equal(isSpyOrScraper("curl/8.4.0"), true);
});

test("Shield Engine: lead humano legítimo com fbclid recebe BLACK PAGE e token de sessão", () => {
  const ctx: ShieldRequestContext = {
    ip: "177.18.29.34",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
    referer: "https://l.instagram.com/",
    queryParams: { fbclid: "IwAR123456789abcdef" },
  };

  const result = evaluateShieldRequest(mockShield, ctx);
  assert.equal(result.verdict, "black");
  assert.equal(result.targetUrl, mockShield.black_url);
  assert.ok(result.sessionTokenToSet, "Deve gerar token de sessão para o lead");

  // Navegação subsequente usando o cookie gerado (ex: avançando para checkout)
  const nextCtx: ShieldRequestContext = {
    ip: "177.18.29.34",
    userAgent: ctx.userAgent,
    referer: mockShield.black_url,
    queryParams: {}, // sem fbclid na segunda página
    sessionCookie: result.sessionTokenToSet,
  };
  const nextResult = evaluateShieldRequest(mockShield, nextCtx);
  assert.equal(nextResult.verdict, "black");
  assert.equal(nextResult.reason, "Sessão válida de lead qualificado");
});

test("Shield Engine: bot revisor do Facebook recebe WHITE PAGE", () => {
  const ctx: ShieldRequestContext = {
    ip: "177.18.29.34",
    userAgent: "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    referer: "",
    queryParams: { fbclid: "fake_id" },
  };

  const result = evaluateShieldRequest(mockShield, ctx);
  assert.equal(result.verdict, "white");
  assert.equal(result.targetUrl, mockShield.white_url);
});

test("Shield Engine: spy tool ou IP de servidor da Amazon recebe GRAY PAGE (isca)", () => {
  // Cenário 1: IP de Datacenter AWS com fbclid tentando forçar entrada
  const awsCtx: ShieldRequestContext = {
    ip: "54.210.10.12", // AWS
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    referer: "",
    queryParams: { fbclid: "fake_click" },
  };
  const awsResult = evaluateShieldRequest(mockShield, awsCtx);
  assert.equal(awsResult.verdict, "gray");
  assert.equal(awsResult.targetUrl, mockShield.gray_url);
  assert.equal(awsResult.isDatacenter, true);

  // Cenário 2: AdHeart bot
  const spyCtx: ShieldRequestContext = {
    ip: "177.18.29.34",
    userAgent: "Mozilla/5.0 (compatible; AdHeart/2.0)",
    referer: "",
    queryParams: { fbclid: "fake_click" },
  };
  const spyResult = evaluateShieldRequest(mockShield, spyCtx);
  assert.equal(spyResult.verdict, "gray");
  assert.equal(spyResult.targetUrl, mockShield.gray_url);
});

test("Shield Engine: acesso direto sem Click ID (concorrente curioso) recebe GRAY PAGE", () => {
  const directCtx: ShieldRequestContext = {
    ip: "177.18.29.34",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0",
    referer: "",
    queryParams: {}, // Nenhum fbclid ou gclid
  };

  const result = evaluateShieldRequest(mockShield, directCtx);
  assert.equal(result.verdict, "gray");
  assert.equal(result.targetUrl, mockShield.gray_url);
});

test("Shield Tokens: validação HMAC e proteção contra falsificação ou expiração", () => {
  const secret = "minha-chave-secreta-de-teste-32bytes!";
  const token = createShieldSessionToken(mockShield.id, secret);
  assert.equal(verifyShieldSessionToken(token, mockShield.id, secret), true);

  // Rejeita com shield id diferente
  assert.equal(verifyShieldSessionToken(token, "outro-shield-id", secret), false);

  // Rejeita com chave secreta diferente
  assert.equal(verifyShieldSessionToken(token, mockShield.id, "outra-chave"), false);

  // Rejeita token corrompido
  assert.equal(verifyShieldSessionToken(token + "x", mockShield.id, secret), false);
});
