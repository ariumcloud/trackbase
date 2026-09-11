import { createHmac, timingSafeEqual } from "node:crypto";
import { checkDatacenterIp, maskIp } from "./datacenter-signatures";
import { isAdReviewerBot, isSpyOrScraper } from "./bot-signatures";
import {
  ShieldRecord,
  ShieldRequestContext,
  ShieldEvaluationResult,
} from "./types";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

// Nunca cair num segredo fixo publicamente conhecido no código: se
// ENCRYPTION_KEY faltar, qualquer pessoa que leia esta fonte conseguiria
// forjar um token de "lead qualificado" e pular direto pra Black Page do
// Shield de qualquer conta, sem passar por nenhuma das checagens de bot.
function shieldSecretKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY não configurada — Shield não pode assinar sessões com segurança.");
  return key;
}

/**
 * Assina um token de sessão de lead usando HMAC-SHA256
 */
export function createShieldSessionToken(
  shieldId: string,
  secretKey: string = shieldSecretKey(),
): string {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${shieldId}:${expiresAt}`;
  const signature = createHmac("sha256", secretKey)
    .update(payload)
    .digest("hex");
  return `${payload}:${signature}`;
}

/**
 * Valida a integridade e expiração de um token de sessão de lead
 */
export function verifyShieldSessionToken(
  token: string | null | undefined,
  shieldId: string,
  secretKey: string = shieldSecretKey(),
): boolean {
  if (!token) return false;
  const parts = token.split(":");
  if (parts.length !== 3) return false;

  const [tokenShieldId, expiresAtStr, receivedSig] = parts;
  if (tokenShieldId !== shieldId) return false;

  const expiresAt = Number(expiresAtStr);
  if (isNaN(expiresAt) || Date.now() > expiresAt) return false;

  const expectedPayload = `${tokenShieldId}:${expiresAtStr}`;
  const expectedSig = createHmac("sha256", secretKey)
    .update(expectedPayload)
    .digest("hex");

  const a = Buffer.from(receivedSig);
  const b = Buffer.from(expectedSig);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Avalia a requisição contra as regras da blindagem (Trackbase Shield)
 */
export function evaluateShieldRequest(
  shield: ShieldRecord,
  ctx: ShieldRequestContext,
  secretKey?: string,
): ShieldEvaluationResult {
  const dcCheck = checkDatacenterIp(ctx.ip);
  const maskedIp = maskIp(ctx.ip);

  // 1. Se o shield estiver desativado, entrega a White Page por segurança
  if (!shield.active) {
    return {
      verdict: "white",
      targetUrl: shield.white_url,
      reason: "Campanha Shield pausada ou inativa",
      isDatacenter: dcCheck.isDatacenter,
      ipMasked: maskedIp,
    };
  }

  // 2. Verifica se o visitante já possui sessão ativa de lead qualificado
  if (verifyShieldSessionToken(ctx.sessionCookie, shield.id, secretKey)) {
    return {
      verdict: "black",
      targetUrl: shield.black_url,
      reason: "Sessão válida de lead qualificado",
      isDatacenter: dcCheck.isDatacenter,
      ipMasked: maskedIp,
    };
  }

  // 3. Verifica se é um bot revisor/moderador de rede de anúncios (Meta, Google, TikTok)
  if (isAdReviewerBot(ctx.userAgent)) {
    return {
      verdict: "white",
      targetUrl: shield.white_url,
      reason: "Bot revisor de anúncios identificado",
      isDatacenter: dcCheck.isDatacenter,
      ipMasked: maskedIp,
    };
  }

  // 4. Verifica User-Agents vazios ou suspeitos se configurado
  if (shield.block_unknown_user_agents && (!ctx.userAgent || !ctx.userAgent.trim())) {
    return {
      verdict: "gray",
      targetUrl: shield.gray_url,
      reason: "User-Agent ausente ou não informado",
      isDatacenter: dcCheck.isDatacenter,
      ipMasked: maskedIp,
    };
  }

  // 5. Verifica ferramentas de espionagem, scrapers ou navegadores headless
  if (isSpyOrScraper(ctx.userAgent)) {
    return {
      verdict: "gray",
      targetUrl: shield.gray_url,
      reason: "Spy tool ou navegador automatizado (headless)",
      isDatacenter: dcCheck.isDatacenter,
      ipMasked: maskedIp,
    };
  }

  // 6. Verifica IPs de Data Centers (AWS, GCP, Azure, Hetzner, etc.)
  if (shield.block_datacenters && dcCheck.isDatacenter) {
    return {
      verdict: "gray",
      targetUrl: shield.gray_url,
      reason: `IP de Data Center (${dcCheck.provider || "Cloud/Hosting"})`,
      isDatacenter: true,
      ipMasked: maskedIp,
    };
  }

  // 7. Verifica presença de Click ID de anúncio (fbclid, gclid, etc.)
  if (shield.require_click_id) {
    const hasClickId = Boolean(
      ctx.queryParams.fbclid ||
      ctx.queryParams.gclid ||
      ctx.queryParams.ttclid ||
      ctx.queryParams.wbraid ||
      ctx.queryParams.gbraid ||
      ctx.queryParams.token,
    );

    if (!hasClickId) {
      return {
        verdict: "gray",
        targetUrl: shield.gray_url,
        reason: "Acesso direto sem Click ID de anúncio (possível concorrente)",
        isDatacenter: dcCheck.isDatacenter,
        ipMasked: maskedIp,
      };
    }
  }

  // 8. Lead humano qualificado! Entrega a Black Page com token de sessão
  const newSessionToken = createShieldSessionToken(shield.id, secretKey);

  return {
    verdict: "black",
    targetUrl: shield.black_url,
    reason: "Lead humano qualificado (tráfego pago)",
    isDatacenter: dcCheck.isDatacenter,
    ipMasked: maskedIp,
    sessionTokenToSet: newSessionToken,
  };
}
