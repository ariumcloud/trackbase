import "server-only";
import { admin } from "./supabase/server";
import { decrypt, encrypt } from "./security";

export class GoogleAdsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleAdsError";
  }
}

export function getGoogleOAuthUrl(workspaceId: string, state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID não configurado.");

  const redirectUri = `${process.env.APP_URL}/api/google/callback`;
  const scope = "https://www.googleapis.com/auth/adwords email profile";

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scope);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);

  return url.toString();
}

export async function exchangeGoogleCode(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token?: string;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${process.env.APP_URL}/api/google/callback`;

  if (!clientId || !clientSecret) {
    throw new Error("Credenciais do Google não configuradas no servidor.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    throw new GoogleAdsError(
      data.error_description || data.error || "Falha na autorização do Google.",
    );
  }

  return data;
}

export async function refreshGoogleToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Credenciais do Google não configuradas no servidor.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    throw new GoogleAdsError("Sessão Google Ads expirou. Conecte novamente.");
  }

  return data;
}

export async function getGoogleCredentials(workspaceId: string, integrationId: string) {
  const service = admin();
  const { data: integration } = await service
    .from("utm_integrations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", integrationId)
    .eq("provider", "google")
    .single();

  const { data: creds } = await service
    .from("utm_credentials")
    .select("token_ciphertext, refresh_token_ciphertext, expires_at")
    .eq("workspace_id", workspaceId)
    .eq("integration_id", integrationId)
    .single();

  if (!integration || !creds?.token_ciphertext) {
    throw new Error("Conecte o Google Ads primeiro.");
  }

  let accessToken = decrypt(creds.token_ciphertext);

  // Check if token expired and refresh if possible
  if (creds.expires_at && Date.parse(creds.expires_at) <= Date.now() + 60000) {
    if (creds.refresh_token_ciphertext) {
      const refreshToken = decrypt(creds.refresh_token_ciphertext);
      const refreshed = await refreshGoogleToken(refreshToken);
      accessToken = refreshed.access_token;

      // Update in database
      await service
        .from("utm_credentials")
        .update({
          token_ciphertext: encrypt(accessToken),
          expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        })
        .eq("integration_id", integrationId);
    }
  }

  return {
    integration,
    accessToken,
    developerToken: process.env.GOOGLE_DEVELOPER_TOKEN || "",
  };
}

export async function listGoogleAccessibleCustomers(accessToken: string, developerToken: string): Promise<string[]> {
  const response = await fetch(
    "https://googleads.googleapis.com/v17/customers:listAccessibleCustomers",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": developerToken,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    },
  );

  const data = await response.json();
  if (!response.ok) {
    // If developer token is in test mode or invalid, fallback gracefully
    return [];
  }

  return (data.resourceNames || []).map((name: string) => name.replace("customers/", ""));
}
