import "server-only";
import { randomBytes } from "node:crypto";
import { digest } from "./security";
import { admin } from "./supabase/server";

export type ApiKeyInfo = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export type CreatedApiKey = ApiKeyInfo & {
  rawKey: string;
};

export async function createApiKey(
  workspaceId: string,
  userId: string,
  name: string = "Claude / Codex MCP",
): Promise<CreatedApiKey> {
  const service = admin();
  const rawKey = `tb_live_${randomBytes(24).toString("hex")}`;
  const keyHash = digest(rawKey);
  const keyPrefix = `${rawKey.slice(0, 16)}...`;

  const { data, error } = await service
    .from("utm_api_keys")
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      name: name.trim() || "Claude / Codex MCP",
      key_hash: keyHash,
      key_prefix: keyPrefix,
      permissions: ["read", "write"],
    })
    .select("id, name, key_prefix, created_at, last_used_at, revoked_at")
    .single();

  if (error) {
    throw new Error(`Falha ao gerar API key: ${error.message}`);
  }

  return {
    id: data.id,
    name: data.name,
    prefix: data.key_prefix,
    createdAt: data.created_at,
    lastUsedAt: data.last_used_at,
    revokedAt: data.revoked_at,
    rawKey,
  };
}

export async function validateApiKey(rawToken: string): Promise<{
  workspaceId: string;
  userId: string;
  permissions: string[];
  keyId: string;
} | null> {
  const clean = rawToken.replace(/^Bearer\s+/i, "").trim();
  if (!clean.startsWith("tb_live_")) {
    return null;
  }

  const hash = digest(clean);
  const service = admin();
  const { data, error } = await service
    .from("utm_api_keys")
    .select("id, workspace_id, user_id, permissions, revoked_at")
    .eq("key_hash", hash)
    .maybeSingle();

  if (error || !data || data.revoked_at) {
    return null;
  }

  // Update last_used_at asynchronously (non-blocking)
  service
    .from("utm_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});

  return {
    workspaceId: data.workspace_id,
    userId: data.user_id,
    permissions: data.permissions || ["read", "write"],
    keyId: data.id,
  };
}

export async function listApiKeys(workspaceId: string): Promise<ApiKeyInfo[]> {
  const service = admin();
  const { data, error } = await service
    .from("utm_api_keys")
    .select("id, name, key_prefix, created_at, last_used_at, revoked_at")
    .eq("workspace_id", workspaceId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((k) => ({
    id: k.id,
    name: k.name,
    prefix: k.key_prefix,
    createdAt: k.created_at,
    lastUsedAt: k.last_used_at,
    revokedAt: k.revoked_at,
  }));
}

export async function revokeApiKey(
  workspaceId: string,
  keyId: string,
): Promise<boolean> {
  const service = admin();
  const { error } = await service
    .from("utm_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("id", keyId);

  return !error;
}
