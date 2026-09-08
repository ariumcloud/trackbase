import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get("host")?.split(":")[0]?.toLowerCase();
  const configuredAppUrl = process.env.APP_URL?.trim();
  const appHost = configuredAppUrl ? new URL(configuredAppUrl).hostname.toLowerCase() : null;

  // Verifica se a requisição veio de um domínio próprio configurado via CNAME
  const isCustomDomain =
    hostname &&
    hostname !== "localhost" &&
    hostname !== "127.0.0.1" &&
    hostname !== appHost &&
    !hostname.endsWith(".vercel.app");

  if (isCustomDomain) {
    const { pathname } = request.nextUrl;
    // Permite que arquivos estáticos, rotas de assets e o tracker passem direto
    if (
      !pathname.startsWith("/_next") &&
      !pathname.startsWith("/api/track") &&
      !pathname.startsWith("/tracker.js") &&
      !pathname.startsWith("/favicon") &&
      !pathname.endsWith(".png") &&
      !pathname.endsWith(".jpg") &&
      !pathname.endsWith(".svg") &&
      !pathname.endsWith(".ico")
    ) {
      // Faz o rewrite transparente mantendo o domínio do cliente na barra do navegador
      const url = request.nextUrl.clone();
      url.pathname = `/s/${hostname}`;
      return NextResponse.rewrite(url);
    }
  }

  const response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;
  const needsAuth =
    pathname.startsWith("/painel") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/meta") ||
    pathname.startsWith("/api/settings") ||
    pathname.startsWith("/auth");

  if (!needsAuth) {
    return response;
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return response;
  }

  let sessionResponse = response;
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: { name: "utmliso-auth" },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items) => {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          sessionResponse = NextResponse.next({ request });
          items.forEach(({ name, value, options }) =>
            sessionResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  await client.auth.getUser();
  return sessionResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
