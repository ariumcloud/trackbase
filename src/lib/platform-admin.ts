import "server-only";
import { db, admin } from "./supabase/server";

/** Workspace admins never imply platform access. Check the live registry on every request. */
export async function isPlatformAdmin(
  client: Awaited<ReturnType<typeof db>>,
  userId: string,
) {
  const { data, error } = await client
    .from("utm_platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return !error && data?.user_id === userId;
}

export async function requirePlatformAdmin() {
  const client = await db();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user || !(await isPlatformAdmin(client, user.id))) {
    throw new Error("Acesso administrativo não autorizado.");
  }
  return { user, client: admin() };
}
