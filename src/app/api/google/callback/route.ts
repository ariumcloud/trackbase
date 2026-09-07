import { requireFeature } from "@/lib/feature-access";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { digest, encrypt } from "@/lib/security";
import { admin, db } from "@/lib/supabase/server";
import { exchangeGoogleCode } from "@/lib/google-ads";

export async function GET(request: Request) {
  const jar = await cookies();
  try {
    const params = new URL(request.url).searchParams;
    const state = params.get("state");
    const code = params.get("code");

    if (!state || !code || jar.get("utm-google-oauth")?.value !== state) {
      throw new Error("Estado inválido.");
    }
    jar.delete("utm-google-oauth");

    const {
      data: { user },
    } = await (await db()).auth.getUser();
    if (!user) throw new Error("Usuário não autenticado.");

    const service = admin();
    const { data: s, error: stateErr } = await service
      .from("utm_oauth_states")
      .delete()
      .eq("state_hash", digest(state))
      .eq("user_id", user.id)
      .gt("expires_at", new Date().toISOString())
      .select("workspace_id")
      .single();

    if (stateErr || !s) throw new Error("Sessão expirada.");

    await requireFeature(s.workspace_id, "integrations");

    const tokenData = await exchangeGoogleCode(code);
    const ciphertext = encrypt(tokenData.access_token);
    const refreshCiphertext = tokenData.refresh_token
      ? encrypt(tokenData.refresh_token)
      : null;

    // Check if integration already exists
    const { data: existing } = await service
      .from("utm_integrations")
      .select("id")
      .eq("workspace_id", s.workspace_id)
      .eq("provider", "google")
      .maybeSingle();

    let integrationId = existing?.id;

    if (!integrationId) {
      const { data: i, error: ie } = await service
        .from("utm_integrations")
        .insert({
          workspace_id: s.workspace_id,
          provider: "google",
          name: "Google Ads",
          status: "connected",
        })
        .select("id")
        .single();
      if (ie) throw ie;
      integrationId = i.id;
    } else {
      await service
        .from("utm_integrations")
        .update({ status: "connected", updated_at: new Date().toISOString() })
        .eq("id", integrationId);
    }

    // Upsert credentials
    const credsPayload: Record<string, unknown> = {
      workspace_id: s.workspace_id,
      integration_id: integrationId,
      token_ciphertext: ciphertext,
      expires_at: tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        : null,
    };

    if (refreshCiphertext) {
      credsPayload.refresh_token_ciphertext = refreshCiphertext;
    }

    const { error: ce } = await service
      .from("utm_credentials")
      .upsert(credsPayload, { onConflict: "workspace_id,integration_id" });

    if (ce) throw ce;

    return NextResponse.redirect(
      new URL(
        `/painel?tab=integracoes&workspace=${s.workspace_id}&connected=google`,
        process.env.APP_URL,
      ),
    );
  } catch (err) {
    console.error("Google OAuth error:", err);
    return NextResponse.redirect(
      new URL("/painel?tab=integracoes&error=google", process.env.APP_URL),
    );
  }
}
