import "server-only";
import { cache } from "react";
import { db, admin } from "./supabase/server";

/**
 * Memoized per-request authenticated user lookup.
 * Eliminates duplicate network calls across layout, page, and server helpers.
 */
export const getAuthUser = cache(async () => {
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

