export const planFeatures = [
  "dashboard",
  "tracking",
  "integrations",
  "capi",
  "alerts",
  "mining",
  "cloner",
  "advancedAlerts",
  "agency",
  "jeen",
  "export",
  "audit",
] as const;
export type PlanFeature = (typeof planFeatures)[number];
export type PlanId = "devedor" | "liso" | "vorcaro";
export const plans = {
  devedor: {
    name: "Plano Devedor",
    workspaces: 1,
    offers: 1,
    links: 10,
    meta: 0,
    features: ["dashboard"] as readonly PlanFeature[],
  },
  liso: {
    name: "Plano Liso",
    workspaces: 1,
    offers: 10,
    links: 200,
    meta: 3,
    features: [
      "dashboard",
      "tracking",
      "integrations",
      "capi",
      "alerts",
    ] as readonly PlanFeature[],
  },
  vorcaro: {
    name: "Plano Vorcaro",
    workspaces: 25,
    offers: 500,
    links: 10000,
    meta: 100,
    features: planFeatures,
  },
} as const;
/** Compatibilidade com registros históricos; novas gravações usam os três IDs oficiais. */
export function normalizePlan(value: string): PlanId {
  if (value === "classe_media" || value === "rico" || value === "vorcaro")
    return "vorcaro";
  return value === "liso" ? "liso" : "devedor";
}
export function canUse(plan: string, feature: PlanFeature): boolean {
  return plans[normalizePlan(plan)].features.includes(feature);
}
export function assertFeature(plan: string, feature: PlanFeature): void {
  if (!canUse(plan, feature))
    throw new Error("Este recurso não está incluído no seu plano.");
}
// Limites operacionais iniciais, centralizados; preços pagos precisam de definição comercial.
