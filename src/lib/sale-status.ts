export const APPROVED_SALE_STATUSES = ["approved", "paid", "completed"] as const;
export const REFUNDED_SALE_STATUSES = [
  "refunded",
  "chargeback",
  "partial_refund",
  "chargedback",
] as const;

export function isApprovedSaleStatus(status: string): boolean {
  return (APPROVED_SALE_STATUSES as readonly string[]).includes(status.trim().toLowerCase());
}

export function isRefundedSaleStatus(status: string): boolean {
  return (REFUNDED_SALE_STATUSES as readonly string[]).includes(status.trim().toLowerCase());
}
