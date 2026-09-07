import { requireFeature } from "@/lib/feature-access";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { digest } from "@/lib/security";
import { admin } from "@/lib/supabase/server";
import { getGoogleOAuthUrl } from "@/lib/google-ads";

export async function GET(request: Request) {
  try {
    const workspace = new URL(request.url).searchParams.get("workspace") ?? "";
    const { user } = await requireFeature(workspace, "integrations");

    if (
      !process.env.GOOGLE_CLIENT_ID ||
      !process.env.GOOGLE_CLIENT_SECRET ||
      !process.env.ENCRYPTION_KEY
    ) {
      return NextResponse.json(
        { error: "Configure as variáveis do Google Ads no servidor." },
        { status: 503 },
      );
    }

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

    (await cookies()).set("utm-google-oauth", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/api/google",
    });

    const url = getGoogleOAuthUrl(workspace, state);
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.json(
      { error: "Não foi possível iniciar a conexão com o Google." },
      { status: 403 },
    );
  }
}
