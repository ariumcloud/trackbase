import "server-only";
import {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { db, admin } from "./supabase/server";
import { z } from "zod";
export function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function matches(value: string, hash: string) {
  const a = Buffer.from(digest(value));
  const b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
}
function key() {
  const k = Buffer.from(process.env.ENCRYPTION_KEY ?? "", "base64");
  if (k.length !== 32)
    throw new Error("Chave de criptografia não configurada.");
  return k;
}
export function encrypt(value: string) {
  const iv = randomBytes(12),
    c = createCipheriv("aes-256-gcm", key(), iv);
  return Buffer.concat([
    iv,
    c.update(value),
    c.final(),
    c.getAuthTag(),
  ]).toString("base64");
}
export function decrypt(value: string) {
  const b = Buffer.from(value, "base64"),
    c = createDecipheriv("aes-256-gcm", key(), b.subarray(0, 12));
  c.setAuthTag(b.subarray(-16));
  return Buffer.concat([c.update(b.subarray(12, -16)), c.final()]).toString();
}
export async function authorize(workspace: string, write = false) {
  z.string().uuid().parse(workspace);
  const client = await db();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error("Entre na sua conta.");
  const { data, error } = await client
    .from("utm_members")
    .select("role")
    .eq("workspace_id", workspace)
    .eq("user_id", user.id)
    .single();
  if (error || !data || (write && !["owner", "admin"].includes(data.role)))
    throw new Error("Workspace não autorizado.");
  return { client, user, role: data.role };
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) throw new Error("Origem não autorizada.");

  const allowedOrigins = new Set([new URL(request.url).origin]);
  const configuredAppUrl = process.env.APP_URL?.trim();
  if (configuredAppUrl) allowedOrigins.add(new URL(configuredAppUrl).origin);

  if (!allowedOrigins.has(origin)) throw new Error("Origem não autorizada.");
}
export async function rateLimit(bucket: string, limit = 120) {
  const { data, error } = await admin().rpc("utm_rate_limit", {
    p_key: digest(bucket),
    p_limit: limit,
  });
  if (error) throw new Error("Controle de tráfego indisponível.");
  return data === true;
}
export async function body(request: Request, max = 65536): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Corpo vazio.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new Error("Payload excede o limite.");
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
