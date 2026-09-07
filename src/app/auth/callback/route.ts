import { NextResponse } from "next/server";
import { db } from "@/lib/supabase/server";
import { authCallbackPath } from "@/lib/auth-redirect";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await (await db()).auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(
        new URL(authCallbackPath(url.searchParams.get("next")), process.env.APP_URL),
      );
    }
  }
  return NextResponse.redirect(
    new URL("/login?error=confirmation", process.env.APP_URL),
  );
}
