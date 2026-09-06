import { requireFeature } from "@/lib/feature-access";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { digest, encrypt } from "@/lib/security";
import { admin, db } from "@/lib/supabase/server";
import { graphVersion } from "@/lib/meta";
async function exchange(parameters: Record<string, string>) {
  const url = new URL(
    `https://graph.facebook.com/${graphVersion()}/oauth/access_token`,
  );
  const result = await fetch(url, {
    method: "POST",
    body: new URLSearchParams(parameters),
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  const value = await result.json();
  if (!result.ok || !value.access_token) throw new Error("OAuth falhou");
  return value as { access_token: string; expires_in?: number };
}
export async function GET(request: Request) {
  const jar = await cookies();
  try {
    const params = new URL(request.url).searchParams,
      state = params.get("state"),
      code = params.get("code");
    if (!state || !code || jar.get("utm-oauth")?.value !== state)
      throw new Error();
    jar.delete("utm-oauth");
    const {
      data: { user },
    } = await (await db()).auth.getUser();
    if (!user) throw new Error();
    const service = admin();
    const { data: s, error } = await service
      .from("utm_oauth_states")
      .delete()
      .eq("state_hash", digest(state))
      .eq("user_id", user.id)
      .gt("expires_at", new Date().toISOString())
      .select("workspace_id")
      .single();
    if (error || !s) throw new Error();
    await requireFeature(s.workspace_id, "integrations");
    const base = {
      client_id: process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
    };
    const short = await exchange({
      ...base,
      code,
      redirect_uri: `${process.env.APP_URL}/api/meta/callback`,
    });
    const token = await exchange({
      ...base,
      grant_type: "fb_exchange_token",
      fb_exchange_token: short.access_token,
    });
    const ciphertext = encrypt(token.access_token);
    const { data: i, error: ie } = await service
      .from("utm_integrations")
      .insert({
        workspace_id: s.workspace_id,
        provider: "meta",
        name: "Meta Ads",
        status: "select_account",
      })
      .select("id")
      .single();
    if (ie) throw ie;
    const { error: ce } = await service.from("utm_credentials").insert({
      workspace_id: s.workspace_id,
      integration_id: i.id,
      token_ciphertext: ciphertext,
      expires_at: token.expires_in
        ? new Date(Date.now() + token.expires_in * 1000).toISOString()
        : null,
    });
    if (ce) {
      await service.from("utm_integrations").delete().eq("id", i.id);
      throw ce;
    }
    return NextResponse.redirect(
      new URL(
        `/painel?tab=integracoes&workspace=${s.workspace_id}`,
        process.env.APP_URL,
      ),
    );
  } catch {
    return NextResponse.redirect(
      new URL("/painel?tab=integracoes&error=meta", process.env.APP_URL),
    );
  }
}
