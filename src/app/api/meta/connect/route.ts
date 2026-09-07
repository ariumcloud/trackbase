import { requireFeature } from "@/lib/feature-access";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { digest } from "@/lib/security";
import { admin } from "@/lib/supabase/server";
import { graphVersion } from "@/lib/meta";
import { META_ADS_READ_SCOPE } from "@/lib/oauth-scopes";
export async function GET(request: Request) {
  try {
    const workspace = new URL(request.url).searchParams.get("workspace") ?? "";
    const { user } = await requireFeature(workspace, "integrations");
    if (
      !process.env.META_APP_ID ||
      !process.env.META_APP_SECRET ||
      !process.env.ENCRYPTION_KEY
    )
      return NextResponse.json(
        { error: "Configure o aplicativo Meta e a criptografia no servidor." },
        { status: 503 },
      );
    const state = randomBytes(32).toString("hex");
    const { error } = await admin()
      .from("utm_oauth_states")
      .insert({
        state_hash: digest(state),
        workspace_id: workspace,
        user_id: user.id,
        expires_at: new Date(Date.now() + 600000).toISOString(),
      });
    if (error) throw error;
    (await cookies()).set("utm-oauth", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/api/meta",
    });
    const url = new URL(
      `https://www.facebook.com/${graphVersion()}/dialog/oauth`,
    );
    url.search = new URLSearchParams({
      client_id: process.env.META_APP_ID,
      redirect_uri: `${process.env.APP_URL}/api/meta/callback`,
      response_type: "code",
      scope: META_ADS_READ_SCOPE,
      state,
    }).toString();
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.json(
      { error: "Não foi possível iniciar a conexão." },
      { status: 403 },
    );
  }
}
