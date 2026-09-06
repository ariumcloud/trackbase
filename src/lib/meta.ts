import "server-only";
import { admin } from "./supabase/server";
import { decrypt } from "./security";
export const graphVersion = () => process.env.META_GRAPH_VERSION || "v23.0";
export class MetaError extends Error {
  constructor(public code: number) {
    super(
      code === 190
        ? "A conexão Meta expirou. Conecte novamente."
        : [10, 200].includes(code)
          ? "A Meta não autorizou esta operação. Confira as permissões do aplicativo e da conta."
          : "A Meta não respondeu. Tente novamente.",
    );
  }
}
export async function graph<T>(
  path: string,
  token: string,
  params: Record<string, string> = {},
  method = "GET",
): Promise<T> {
  const url = new URL(`https://graph.facebook.com/${graphVersion()}/${path}`);
  if (method === "GET")
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(method === "POST"
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : {}),
    },
    body: method === "POST" ? new URLSearchParams(params) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  const result = await response.json();
  if (!response.ok || result.error)
    throw new MetaError(result.error?.code ?? 0);
  return result as T;
}
export async function pages<T>(
  path: string,
  token: string,
  params: Record<string, string>,
): Promise<T[]> {
  const all: T[] = [];
  let after: string | undefined;
  for (let page = 0; page < 100; page++) {
    const result = await graph<{
      data: T[];
      paging?: { next?: string; cursors?: { after?: string } };
    }>(path, token, { ...params, limit: "100", ...(after ? { after } : {}) });
    all.push(...result.data);
    if (!result.paging?.next) return all;
    after = result.paging.cursors?.after;
    if (!after) throw new Error("Paginação Meta incompleta.");
  }
  throw new Error("Volume excede a sincronização manual. Reduza o período.");
}
export async function credentials(workspace: string, id: string) {
  const service = admin();
  const { data: i } = await service
    .from("utm_integrations")
    .select("*")
    .eq("workspace_id", workspace)
    .eq("id", id)
    .eq("provider", "meta")
    .single();
  const { data: c } = await service
    .from("utm_credentials")
    .select("token_ciphertext,expires_at")
    .eq("workspace_id", workspace)
    .eq("integration_id", id)
    .single();
  if (!i || !c?.token_ciphertext) throw new Error("Conecte a Meta primeiro.");
  if (c.expires_at && Date.parse(c.expires_at) <= Date.now())
    throw new MetaError(190);
  return { integration: i, token: decrypt(c.token_ciphertext) };
}
export type Account = {
  id: string;
  name: string;
  currency: string;
  timezone_name: string;
};
export type RawInsight = {
  ad_id: string;
  campaign_id: string;
  adset_id: string;
  date_start: string;
  account_currency: string;
  spend: string;
  impressions: string;
  inline_link_clicks?: string;
  reach?: string;
  actions?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[];
};
