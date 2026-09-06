export const plans = {
  devedor: {
    name: "UTMDevedor",
    workspaces: 1,
    offers: 1,
    meta: 1,
    capi: false,
    advanced: false,
  },
  liso: {
    name: "UTMLiso",
    workspaces: 1,
    offers: 10,
    meta: 3,
    capi: true,
    advanced: false,
  },
  classe_media: {
    name: "UTMClasse Média",
    workspaces: 3,
    offers: 50,
    meta: 10,
    capi: true,
    advanced: true,
  },
  rico: {
    name: "UTMRico",
    workspaces: 25,
    offers: 500,
    meta: 100,
    capi: true,
    advanced: true,
  },
} as const;
// Valores pagos são provisórios; aplicação de limites e cobrança pertencem à Fase 4.
