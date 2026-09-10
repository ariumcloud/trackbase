import { createHash } from "node:crypto";

export type CapiEventName =
  | "PageView"
  | "ViewContent"
  | "Lead"
  | "InitiateCheckout"
  | "Purchase"
  | "Refund"
  | "Chargeback";

export type CapiUserData = {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  clientIp?: string | null;
  clientUserAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
};

export type CapiCustomData = {
  value?: number | null;
  currency?: string | null;
  content_name?: string | null;
  content_type?: string | null;
  content_ids?: string[] | null;
};

export type CapiPayload = {
  occurredAt?: string;
  workspaceId: string;
  offerId?: string | null;
  eventName: CapiEventName;
  eventId: string;
  url?: string | null;
  userData?: CapiUserData;
  customData?: CapiCustomData;
};

export function hashPii(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export function normalizeCapiUserData(data: CapiUserData = {}) {
  const result: Record<string, string | string[]> = {};

  if (data.email) {
    result.em = [hashPii(data.email)];
  }
  if (data.phone) {
    const digits = data.phone.replace(/\D/g, "");
    if (digits) result.ph = [hashPii(digits)];
  }
  if (data.firstName) {
    result.fn = [hashPii(data.firstName)];
  }
  if (data.lastName) {
    result.ln = [hashPii(data.lastName)];
  }

  // Dados técnicos NÃO recebem hash segundo a especificação oficial da Meta
  if (data.clientIp) {
    result.client_ip_address = data.clientIp.slice(0, 100);
  }
  if (data.clientUserAgent) {
    result.client_user_agent = data.clientUserAgent.slice(0, 500);
  }
  if (data.fbp) {
    result.fbp = data.fbp.slice(0, 200);
  }
  if (data.fbc) {
    result.fbc = data.fbc.slice(0, 200);
  }

  return result;
}
