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
};
export type LinkRow = {
  id: string;
  name: string;
  url: string;
  offer_id: string;
  params: Record<string, string>;
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
