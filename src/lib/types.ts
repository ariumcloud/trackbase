export type Workspace = {
  id: string;
  name: string;
  timezone: string;
  default_currency?: string;
  plan: string;
  push_settings?: {
    title_template?: string;
    body_template?: string;
    show_buyer?: boolean;
  };
};
export type Offer = {
  id: string;
  name: string;
  landing_url: string;
  currency: string;
  public_key?: string;
  product_type?: string;
  platform?: string;
  parent_offer_id?: string | null;
  checkout_url?: string | null;
  percent_fee?: number;
  fixed_fee?: number;
  cost_per_sale?: number;
  active?: boolean;
};
export type LinkRow = {
  id: string;
  name: string;
  url: string;
  offer_id: string;
  params: Record<string, string>;
  active: boolean;
  public_key?: string;
  created_at: string;
};
export type DashboardSummary = {
  sales_count: number;
  unique_buyers: number;
  gross_revenue: number;
  platform_fees: number;
  net_revenue: number;
  operating_profit: number | null;
  refunded_count: number;
  refunded_amount: number;
  meta_spend: number | null;
  meta_clicks: number;
  meta_impressions: number;
  pageviews: number;
  ctas: number;
  checkouts: number;
  by_product_type: Record<string, { count: number; revenue: number }>;
  by_country: Record<string, { count: number; revenue: number }>;
};
export type PixelRow = {
  id: string;
  pixel_id: string;
  offer_id: string | null;
  test_event_code: string | null;
  active: boolean;
  created_at: string;
};
export type Integration = {
  id: string;
  name: string;
  provider: string;
  status: string;
  offer_id: string | null;
  account_id: string | null;
  currency: string | null;
  last_synced_at: string | null;
};
export type SaleRow = {
  id: string;
  offer_id: string;
  provider: string;
  status: string;
  amount: number;
  gross_amount?: number;
  fee_amount?: number;
  fee_currency?: string | null;
  net_amount?: number;
  net_currency?: string | null;
  product_type?:
    | "main"
    | "order_bump"
    | "upsell"
    | "downsell"
    | "subscription"
    | "complementary"
    | "alternative";
  parent_transaction_id?: string | null;
  payment_method?: string | null;
  currency: string | null;
  country: string | null;
  attribution: Record<string, string>;
  is_test: boolean;
  occurred_at: string;
};
export type InsightRow = {
  integration_id?: string;
  ad_id: string;
  campaign_id: string;
  adset_id: string;
  day: string;
  currency: string;
  spend: number;
  clicks: number;
  impressions: number;
};
export type Entity = {
  integration_id: string;
  external_id: string;
  kind: string;
  parent_id?: string | null;
  name: string;
  status: string;
  budget_minor?: number | null;
  budget_currency?: string | null;
  budget_type?: "daily" | "lifetime" | null;
  meta_created_at?: string | null;
};
export type WebhookLog = {
  id: string;
  integration_id: string;
  event_id: string;
  status: string;
  reason: string | null;
  received_at: string;
  is_test: boolean;
};
export type TrackingEvent = {
  id: string;
  workspace_id: string;
  offer_id: string;
  link_id: string | null;
  event_type: string;
  session_id: string;
  url: string;
  attribution: Record<string, string>;
  created_at: string;
};
export type FunnelRow = {
  id: string;
  workspace_id: string;
  offer_id: string | null;
  name: string;
  source_url: string | null;
  status: "draft" | "published" | "archived";
  version: number;
  blocks: unknown[];
  pixels: unknown[];
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};
export type DiagnosticRow = {
  id: string;
  workspace_id: string;
  offer_id: string | null;
  url: string | null;
  score: number;
  category_scores: Record<string, unknown>;
  bottlenecks: unknown[];
  recommendations: string[];
  metrics_snapshot: Record<string, unknown>;
  created_at: string;
};
export type ShieldRow = {
  id: string;
  workspace_id: string;
  offer_id: string;
  name: string;
  slug: string;
  custom_domain?: string | null;
  white_url: string;
  gray_url: string;
  black_url: string;
  require_click_id: boolean;
  block_datacenters: boolean;
  block_unknown_user_agents: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
};
export type ShieldLogRow = {
  id: string;
  shield_id: string;
  workspace_id: string;
  verdict: "white" | "gray" | "black";
  reason: string;
  ip_masked: string | null;
  is_datacenter: boolean;
  user_agent: string | null;
  referer: string | null;
  created_at: string;
};
