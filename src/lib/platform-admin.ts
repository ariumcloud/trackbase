import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { db, admin } from "./supabase/server";

/**
 * Memoized per-request authenticated user lookup.
 *
 * middleware.ts already calls auth.getUser() for every /painel and /admin
 * request (that's a real network round-trip to Supabase Auth, needed to
 * validate the JWT and refresh the session cookie) and forwards the
 * validated result via the x-tb-auth-user request header -- middleware
 * always overwrites or strips that header itself, so a client can never
 * forge it. Reusing it here avoids paying for that same round-trip twice
 * on every protected page load. If the header is absent (a caller outside
 * the paths middleware covers), fall back to a real check.
 */
export const getAuthUser = cache(async () => {
  const forwarded = (await headers()).get("x-tb-auth-user");
  if (forwarded !== null) {
    if (!forwarded) return null;
    try {
      return JSON.parse(Buffer.from(forwarded, "base64").toString("utf-8")) as User;
    } catch {
      // Malformed value: fall through to a real check rather than trust it.
    }
  }
  const client = await db();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) return null;
  return user;
});

/**
 * Memoized per-request platform admin check.
 */
export const checkPlatformAdmin = cache(async (userId: string) => {
  if (!userId) return false;
  const client = await db();
  const { data, error } = await client
    .from("utm_platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return !error && data?.user_id === userId;
});

/** Workspace admins never imply platform access. Check the live registry on every request. */
export async function isPlatformAdmin(
  _client: Awaited<ReturnType<typeof db>>,
  userId: string,
) {
  return checkPlatformAdmin(userId);
}

export const requirePlatformAdmin = cache(async () => {
  const user = await getAuthUser();
  if (!user || !(await checkPlatformAdmin(user.id))) {
    throw new Error("Acesso administrativo não autorizado.");
  }
  return { user, client: admin() };
});

