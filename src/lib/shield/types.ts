export type ShieldVerdict = "white" | "gray" | "black";

export interface ShieldRecord {
  id: string;
  workspace_id: string;
  offer_id: string;
  name: string;
  slug: string;
  white_url: string;
  gray_url: string;
  black_url: string;
  require_click_id: boolean;
  block_datacenters: boolean;
  block_unknown_user_agents: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShieldRequestContext {
  ip: string;
  userAgent: string;
  referer: string;
  queryParams: Record<string, string>;
  sessionCookie?: string | null;
}

export interface ShieldEvaluationResult {
  verdict: ShieldVerdict;
  targetUrl: string;
  reason: string;
  isDatacenter: boolean;
  ipMasked: string;
  sessionTokenToSet?: string;
}
