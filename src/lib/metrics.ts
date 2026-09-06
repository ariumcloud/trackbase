export type Sale = {
  currency: string | null;
  amount: number;
  status: string;
  is_test: boolean;
  occurred_at: string;
};
export type Insight = {
  currency: string;
  spend: number;
  impressions: number;
  clicks: number;
};
export function calculate(
  sales: Sale[],
  insights: Insight[],
  currency: string,
) {
  const paid = sales.filter(
    (s) => !s.is_test && s.currency === currency && s.status === "approved",
  );
  const ads = insights.filter((i) => i.currency === currency);
  const revenue = paid.reduce((s, v) => s + Number(v.amount), 0),
    spend = ads.length ? ads.reduce((s, v) => s + Number(v.spend), 0) : null;
  const impressions = ads.reduce((s, v) => s + Number(v.impressions), 0),
    clicks = ads.reduce((s, v) => s + Number(v.clicks), 0);
  return {
    revenue,
    purchases: paid.length,
    spend,
    profit: spend === null ? null : revenue - spend,
    roas: spend ? revenue / spend : null,
    roi: spend ? ((revenue - spend) / spend) * 100 : null,
    cpa: spend !== null && paid.length ? spend / paid.length : null,
    ctr: impressions ? (clicks / impressions) * 100 : null,
    cpc: clicks && spend !== null ? spend / clicks : null,
    clicks,
    impressions,
  };
}
export function dayInZone(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
