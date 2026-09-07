import "server-only";
import { admin } from "./supabase/server";
import { decrypt } from "./security";
import { appUrl } from "./app-url";
export const graphVersion = () => process.env.META_GRAPH_VERSION || "v23.0";
export const metaRedirectUri = () => `${appUrl()}/api/meta/callback`;
export class MetaError extends Error {
  readonly internalCode: "token_expired" | "permission_insufficient" | "rate_limited" | "api_unavailable";
  constructor(public code: number, public stage = "meta_request") {
    super(
      code === 190
        ? "A conexão Meta expirou. Conecte novamente."
        : [10, 200].includes(code)
          ? "A Meta não autorizou esta operação. Confira as permissões do aplicativo e da conta."
          : "A Meta não respondeu. Tente novamente.",
    );
    this.internalCode = code === 190
      ? "token_expired"
      : [10, 100, 200, 294].includes(code)
        ? "permission_insufficient"
        : [4, 17, 32, 613].includes(code)
          ? "rate_limited"
          : "api_unavailable";
  }
}
export function normalizeAdAccountId(value: string): string | null {
  const match = value.trim().match(/^(?:act_)?(\d+)$/i);
  return match ? `act_${match[1]}` : null;
}
export async function graph<T>(
  path: string,
  token: string,
  params: Record<string, string> = {},
  method = "GET",
  stage = "meta_request",
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
  const result = await response.json().catch(() => null);
  if (!response.ok || result.error)
    throw new MetaError(result?.error?.code ?? (response.status === 429 ? 4 : 0), stage);
  return result as T;
}
export async function pages<T>(
  path: string,
  token: string,
  params: Record<string, string>,
  stage = "meta_pagination",
): Promise<T[]> {
  const all: T[] = [];
  let after: string | undefined;
  for (let page = 0; page < 100; page++) {
    const result = await graph<{
      data: T[];
      paging?: { next?: string; cursors?: { after?: string } };
    }>(path, token, { ...params, limit: "100", ...(after ? { after } : {}) }, "GET", stage);
    all.push(...result.data);
    if (!result.paging?.next) return all;
    after = result.paging.cursors?.after;
    if (!after) throw new MetaError(0, stage);
  }
  throw new MetaError(0, stage);
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
export type Business = { id: string; name: string };
export type MetaAccount = Account & {
  origins: Array<{ type: "direct" | "business"; businessId?: string; businessName?: string }>;
};
export async function metaPermissions(token: string) {
  const value = await graph<{ data?: Array<{ permission: string; status: string }> }>(
    "me/permissions", token, { fields: "permission,status" }, "GET", "permissions",
  );
  const granted = new Set((value.data ?? []).filter((item) => item.status === "granted").map((item) => item.permission));
  return { adsRead: granted.has("ads_read"), businessManagement: granted.has("business_management") };
}
function appendAccount(accounts: Map<string, MetaAccount>, account: Account, origin: MetaAccount["origins"][number]) {
  const id = normalizeAdAccountId(account.id);
  if (!id) return;
  const existing = accounts.get(id);
  if (existing) existing.origins.push(origin);
  else accounts.set(id, { ...account, id, origins: [origin] });
}
export async function listMetaAccounts(token: string) {
  const permissions = await metaPermissions(token);
  if (!permissions.adsRead) throw new MetaError(200, "permissions");
  const accounts = new Map<string, MetaAccount>();
  const direct = await pages<Account>("me/adaccounts", token, { fields: "id,name,currency,timezone_name" }, "direct_accounts");
  direct.forEach((account) => appendAccount(accounts, account, { type: "direct" }));
  if (!permissions.businessManagement) return { accounts: [...accounts.values()], businesses: [] as Business[], permissions };
  const businesses = await pages<Business>("me/businesses", token, { fields: "id,name" }, "businesses");
  for (const business of businesses) {
    const [owned, client] = await Promise.all([
      pages<Account>(`${business.id}/owned_ad_accounts`, token, { fields: "id,name,currency,timezone_name" }, "business_accounts"),
      pages<Account>(`${business.id}/client_ad_accounts`, token, { fields: "id,name,currency,timezone_name" }, "business_accounts"),
    ]);
    [...owned, ...client].forEach((account) => appendAccount(accounts, account, { type: "business", businessId: business.id, businessName: business.name }));
  }
  return { accounts: [...accounts.values()].sort((a, b) => a.name.localeCompare(b.name)), businesses, permissions };
}
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
