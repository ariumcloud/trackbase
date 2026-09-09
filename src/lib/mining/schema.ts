import { z } from "zod";

export const workspaceSchema = z.string().uuid();
export function publicUrl(value: string) {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !/^(localhost|.*\.local|.*\.internal|\[.*\]|[\d.]+)$/.test(u.hostname) &&
      u.hostname.includes(".")
    );
  } catch {
    return false;
  }
}
const url = z
  .string()
  .max(4096)
  .refine(publicUrl, "URL HTTPS pública inválida.");
const text = (n: number) => z.string().trim().max(n);
export const captureSchema = z
  .object({
    library_id: z.string().regex(/^\d{5,40}$/),
    advertiser: text(300).min(1),
    page_name: text(300).nullable().default(null),
    page_id: z
      .string()
      .regex(/^\d{1,40}$/)
      .nullable()
      .default(null),
    copy: text(16000).default(""),
    headline: text(1000).default(""),
    landing_url: url.nullable().default(null),
    media: z
      .array(
        z
          .object({
            url,
            type: z.enum(["image", "video"]),
            temporary: z.literal(true).default(true),
          })
          .strict(),
      )
      .max(20)
      .default([]),
    format: z
      .enum(["image", "video", "carousel", "dynamic", "unknown"])
      .default("unknown"),
    platforms: z
      .array(
        z.enum([
          "Facebook",
          "Instagram",
          "Messenger",
          "Audience Network",
          "Threads",
        ]),
      )
      .max(5)
      .default([]),
    start_date: z.iso
      .date()
      .refine((v) => v <= new Date().toISOString().slice(0, 10), "Data futura.")
      .nullable()
      .default(null),
    days_active: z.number().int().min(0).max(36500).nullable().default(null),
    activity: z.enum(["active", "inactive", "unknown"]).default("unknown"),
    related_count: z
      .number()
      .int()
      .min(1)
      .max(1000000)
      .nullable()
      .default(null),
  })
  .strict();
export const updateSchema = z
  .object({
    niche: text(200).optional(),
    tags: z.array(text(50).min(1)).max(20).optional(),
    notes: text(8000).optional(),
    status: z.enum(["saved", "reviewed", "archived"]).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0);
export const filtersSchema = z
  .object({
    workspace: workspaceSchema,
    q: text(200).default(""),
    format: z
      .enum(["image", "video", "carousel", "dynamic", "unknown"])
      .optional(),
    status: z.enum(["saved", "reviewed", "archived"]).optional(),
    tag: text(50).optional(),
    min_days: z.coerce.number().int().min(0).max(36500).optional(),
    max_days: z.coerce.number().int().min(0).max(36500).optional(),
    sort: z.enum(["saved", "days", "advertiser"]).default("saved"),
    page: z.coerce.number().int().min(0).max(10000).default(0),
  })
  .strict();
export const monitorSchema = z
  .object({
    offer_id: workspaceSchema.nullable().default(null),
    page_id: z
      .string()
      .regex(/^\d{1,40}$/)
      .nullable()
      .default(null),
    label: text(300).min(1),
    status: z.enum(["active", "paused"]).default("active"),
  })
  .strict()
  .refine(
    (v) => Boolean(v.offer_id) !== Boolean(v.page_id),
    "Escolha oferta ou página.",
  );
const finding = z
  .object({
    text: text(2500),
    basis: z.enum(["observed", "hypothesis", "unavailable"]),
  })
  .strict();
export const analysisSchema = z
  .object({
    summary: finding,
    angle: finding,
    hook: finding,
    promise: finding,
    mechanism: finding,
    audience: finding,
    awareness: finding,
    proof: finding,
    cta: finding,
    copy_structure: finding,
    strengths: z.array(finding).max(10),
    weaknesses: z.array(finding).max(10),
    longevity_hypotheses: z.array(text(1500)).max(10),
    variations: z.array(text(1500)).max(10),
    suggested_tags: z.array(text(50)).max(20),
    confidence: z.number().min(0).max(1),
  })
  .strict();
export type Capture = z.infer<typeof captureSchema>;
export type Analysis = z.infer<typeof analysisSchema>;
export type MinedOffer = {
  id: string;
  workspace_id: string;
  library_id: string;
  advertiser: string;
  library_url: string;
  capture: Capture;
  niche: string;
  tags: string[];
  notes: string;
  status: string;
  created_at: string;
  updated_at: string;
  captured_at: string;
  days_active: number | null;
};
export type Monitor = {
  id: string;
  offer_id: string | null;
  page_id: string | null;
  label: string;
  status: string;
  last_checked_at: string | null;
  next_check_at: string | null;
  last_error: string | null;
  execution_status: string;
};
export function changes(
  previous: Record<string, unknown>,
  current: Record<string, unknown>,
) {
  return Object.keys(current)
    .filter((k) => JSON.stringify(previous[k]) !== JSON.stringify(current[k]))
    .map((field) => ({
      field,
      before: previous[field] ?? null,
      after: current[field] ?? null,
    }));
}
export function libraryUrl(id: string) {
  return `https://www.facebook.com/ads/library/?id=${id}`;
}
