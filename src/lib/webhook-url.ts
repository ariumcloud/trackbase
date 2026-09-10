import { paymentProviders } from "./payment-contract";

/** Public gateway callbacks must never point to a developer machine. */
export function gatewayWebhookUrl(base: string, provider: string, integrationId: string): string {
  if (!(paymentProviders as readonly string[]).includes(provider)) throw new Error("Gateway inválido");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(integrationId)) throw new Error("Integração inválida");
  let origin = "https://trackbase.com.br";
  try {
    const parsed = new URL(base.trim());
    const host = parsed.hostname.toLowerCase();
    const local = host === "localhost" || host.endsWith(".localhost") || host === "[::1]" || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
    if (parsed.protocol === "https:" && !parsed.username && !parsed.password && !local) origin = parsed.origin;
  } catch { /* Use the canonical public application when configuration is missing. */ }
  return `${origin}/api/webhooks/${provider}/${integrationId}`;
}
