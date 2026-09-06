export type Workspace = {
  id: string;
  name: string;
  timezone: string;
  plan: string;
};
export type Offer = {
  id: string;
  name: string;
  landing_url: string;
  currency: string;
  public_key?: string;
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
  net_amount?: number;
  product_type?: "main" | "order_bump" | "upsell" | "downsell";
  parent_transaction_id?: string | null;
  currency: string | null;
  country: string | null;
  attribution: Record<string, string>;
  is_test: boolean;
  occurred_at: string;
};
export type InsightRow = {
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
  name: string;
  status: string;
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
