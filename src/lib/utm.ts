import { z } from "zod";
export const webUrl = z
  .string()
  .url()
  .max(2048)
  .refine(
    (v) =>
      ["https:", "http:"].includes(new URL(v).protocol) &&
      !new URL(v).username &&
      !new URL(v).password,
    "Use uma URL HTTP ou HTTPS sem credenciais.",
  );
export const linkSchema = z.object({
  name: z.string().trim().min(2).max(120),
  url: webUrl,
  offer_id: z.string().uuid(),
  params: z
    .record(
      z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,49}$/),
      z.string().max(300),
    )
    .refine((p) => Object.keys(p).length <= 30),
});
export const metaDefaults = {
  utm_source: "meta",
  utm_medium: "paid_social",
  utm_campaign: "{{campaign.id}}",
  utm_term: "{{adset.id}}",
  utm_content: "{{ad.id}}",
  utm_placement: "{{placement}}",
};
const readable = (s: string) =>
  s
    .replace(/%7B%7B(campaign|adset|ad)\.id%7D%7D/gi, "{{$1.id}}")
    .replace(/%7B%7Bplacement%7D%7D/gi, "{{placement}}")
    .replace(/%7B%7Bsite_source_name%7D%7D/gi, "{{site_source_name}}");
export function buildLink(url: string, params: Record<string, string>) {
  const destination = new URL(webUrl.parse(url));
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (value.trim()) {
      query.set(key, value.trim());
      destination.searchParams.set(key, value.trim());
    }
  return {
    full: readable(destination.toString()),
    parameters: readable(query.toString()),
  };
}
export function mergeAttribution(
  previous: Record<string, string>,
  incoming: Record<string, string>,
) {
  const fresh = Object.keys(incoming).some(
    (k) => k.startsWith("utm_") && incoming[k],
  );
  return fresh
    ? Object.fromEntries(
        Object.entries(incoming).filter(([k, v]) => k.startsWith("utm_") && v),
      )
    : previous;
}
