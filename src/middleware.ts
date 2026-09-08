import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function isInternalHost(hostname: string | undefined, appHost: string | null): boolean {
  if (!hostname) return true;
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".vercel.app") ||
    hostname === "trackbase.com.br" ||
    hostname.endsWith(".trackbase.com.br")
  ) {
    return true;
  }
  if (appHost) {
    if (hostname === appHost || hostname.endsWith(`.${appHost}`)) {
      return true;
    }
    const parts = appHost.split(".");
    if (parts.length >= 2) {
      const rootDomain = parts.slice(-2).join(".");
      if (hostname === rootDomain || hostname.endsWith(`.${rootDomain}`)) {
        return true;
      }
    }
  }
  return false;
}

const INTERNAL_PATHS = [
  "/_next",
  "/login",
  "/painel",
  "/auth",
  "/api",
  "/demo",
  "/recuperar-senha",
  "/privacidade",
  "/termos",
  "/s/",
  "/tracker.js",
  "/favicon.ico",
];

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get("host")?.split(":")[0]?.toLowerCase();
  const configuredAppUrl = process.env.APP_URL?.trim();
  let appHost: string | null = null;
  try {
    if (configuredAppUrl) {
      appHost = new URL(
        configuredAppUrl.startsWith("http") ? configuredAppUrl : `https://${configuredAppUrl}`,
      ).hostname.toLowerCase();
    }
  } catch {
    appHost = null;
  }

  const { pathname } = request.nextUrl;

  // Verifica se a requisição veio de um domínio próprio configurado via CNAME
  const isCustomDomain = !isInternalHost(hostname, appHost);

  if (isCustomDomain) {
    const isInternalPath =
      INTERNAL_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
      Boolean(pathname.match(/\.(png|jpg|jpeg|svg|ico|css|js|woff|woff2|webp)$/i));

    if (!isInternalPath) {
      // Faz o rewrite transparente mantendo o domínio do cliente na barra do navegador
      const url = request.nextUrl.clone();
      url.pathname = `/s/${hostname}`;
      return NextResponse.rewrite(url);
    }
  }

  const response = NextResponse.next({ request });
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
