import { createServerClient, type CookieOptions } from "@supabase/ssr";
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
  "/admin",
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
      const rewriteHeaders = new Headers(request.headers);
      rewriteHeaders.delete("x-tb-auth-user");
      return NextResponse.rewrite(url, { request: { headers: rewriteHeaders } });
    }
  }

  // /login has no auth-dependent logic (AuthForm never reads the session),
  // and /auth/callback exchanges its own code via a separate Supabase call
  // that doesn't touch this cookie-refresh step either -- both used to pay
  // for a getUser() round-trip here for nothing, right on the sign-in path.
  const needsAuth =
    pathname.startsWith("/painel") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/meta") ||
    pathname.startsWith("/api/settings");

  // Strip this on every path we don't compute it for ourselves below, so a
  // client can never inject a value that downstream code (getAuthUser) would
  // mistake for a value middleware actually verified against Supabase Auth.
  const passthroughHeaders = new Headers(request.headers);
  passthroughHeaders.delete("x-tb-auth-user");

  if (!needsAuth) {
    return NextResponse.next({ request: { headers: passthroughHeaders } });
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return NextResponse.next({ request: { headers: passthroughHeaders } });
  }

  let pendingCookies: { name: string; value: string; options?: CookieOptions }[] = [];
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: { name: "utmliso-auth" },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items) => {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          pendingCookies = items;
        },
      },
    },
  );
  const {
    data: { user },
  } = await client.auth.getUser();

  // getAuthUser() (src/lib/platform-admin.ts) reads this instead of calling
  // auth.getUser() again on every /painel and /admin page render -- that
  // second call was a full extra round-trip to Supabase Auth on top of this
  // one, doubling the auth latency on every protected page load and on login.
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set(
    "x-tb-auth-user",
    user ? Buffer.from(JSON.stringify(user)).toString("base64") : "",
  );

  const sessionResponse = NextResponse.next({ request: { headers: forwardedHeaders } });
  pendingCookies.forEach(({ name, value, options }) =>
    sessionResponse.cookies.set(name, value, options),
  );
  return sessionResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|tracker\\.js|sw\\.js|cash-machine\\.mp3|kaching\\.wav|manifest\\.json|api/track|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|mp3|wav|woff2?)$).*)",
  ],
};
