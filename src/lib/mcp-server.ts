import "server-only";
import { admin } from "./supabase/server";
import { randomBytes } from "node:crypto";
import { isApprovedSaleStatus, isRefundedSaleStatus } from "./sale-status";
import { convertCurrencyAmount, type ExchangeRates } from "./currency";

async function fetchExchangeRates(): Promise<ExchangeRates | null> {
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD", { next: { revalidate: 21600 } });
    if (!response.ok) return null;
    const data = await response.json();
    if (data.result !== "success" || !data.rates) return null;
    return { USD: 1, ...data.rates };
  } catch {
    return null;
  }
}

export type McpRequest = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
};

export type McpResponse = {
  jsonrpc: "2.0";
  id?: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
};

const MCP_TOOLS = [
  {
    name: "get_metrics",
    description: "Obtém resumo financeiro e métricas de tráfego do workspace: faturamento, vendas aprovadas, ticket médio, reembolsos, gastos de anúncios e ROAS real.",
    inputSchema: {
      type: "object",
      properties: {
        period: {
          type: "string",
          enum: ["today", "yesterday", "7d", "30d"],
          description: "Período para análise das métricas (padrão: 7d)",
        },
      },
    },
  },
  {
    name: "list_campaigns",
    description: "Lista todas as campanhas de tráfego pago (Meta Ads e Google Ads) com gasto, receita atribuída, compras e ROAS.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "list_offers",
    description: "Lista as ofertas cadastradas no Trackbase com páginas de vendas, checkouts configurados e moedas.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "create_tracking_link",
    description: "Cria um link de rastreamento com parâmetros UTMs completos (origem, campanha, anúncio/criativo).",
    inputSchema: {
      type: "object",
      required: ["offer_id", "name", "utm_source"],
      properties: {
        offer_id: { type: "string", description: "UUID da oferta no Trackbase" },
        name: { type: "string", description: "Nome identificador do link (ex.: Anúncio Vídeo 01 Feed)" },
        utm_source: { type: "string", description: "Origem do tráfego (ex.: facebook, instagram, google, tiktok)" },
        utm_medium: { type: "string", description: "Meio de divulgação (ex.: cpc, story, feed, bio)" },
        utm_campaign: { type: "string", description: "Nome ou código da campanha" },
        utm_content: { type: "string", description: "Identificador do criativo / anúncio" },
        utm_term: { type: "string", description: "Público ou palavra-chave" },
      },
    },
  },
  {
    name: "get_recent_sales",
    description: "Lista as vendas mais recentes registradas via gateways (Hotmart, Kiwify, Cakto, etc.) com status, valor e UTMs.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Quantidade de vendas para retornar (máx. 50, padrão 10)" },
      },
    },
  },
  {
    name: "get_mined_offers",
    description: "Busca ofertas de concorrentes mineradas na biblioteca de anúncios com criativos, copies e dias ativos.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Termo de busca (nicho, anunciante ou palavra-chave)" },
      },
    },
  },
];

export async function executeMcpMethod(
  workspaceId: string,
  userId: string,
  method: string,
  params: Record<string, unknown> = {},
): Promise<unknown> {
  switch (method) {
    case "initialize":
      return {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: "trackbase-mcp",
          version: "1.0.0",
        },
      };

    case "notifications/initialized":
    case "ping":
      return {};

    case "tools/list":
      return { tools: MCP_TOOLS };

    case "tools/call": {
      const toolName = String(params.name || "");
      const args = (params.arguments || {}) as Record<string, unknown>;

      const knownTools = ["get_metrics", "list_campaigns", "list_offers", "create_tracking_link", "get_recent_sales", "get_mined_offers"];
      if (!knownTools.includes(toolName)) {
        throw new Error(`Tool desconhecida: ${toolName}`);
      }

      const service = admin();

      switch (toolName) {
        case "get_metrics": {
          const period = String(args.period || "7d");
          const now = new Date();
          let startDate: Date;

          if (period === "today") {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          } else if (period === "yesterday") {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
          } else if (period === "30d") {
            startDate = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
          } else {
            startDate = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
          }

          const { data: workspace } = await service
            .from("utm_workspaces")
            .select("default_currency")
            .eq("id", workspaceId)
            .maybeSingle();
          const reportCurrency = workspace?.default_currency || "USD";
          const rates = await fetchExchangeRates();

          const { data: sales } = await service
            .from("utm_sales")
            .select("amount, gross_amount, net_amount, status, occurred_at, currency, is_test")
            .eq("workspace_id", workspaceId)
            .eq("is_test", false)
            .gte("occurred_at", startDate.toISOString())
            .lte("occurred_at", now.toISOString());

          const converted = (s: { amount: number | null; gross_amount: number | null; currency: string | null }) =>
            convertCurrencyAmount(Number(s.gross_amount) || Number(s.amount) || 0, s.currency, reportCurrency, rates) ?? 0;
          const convertedNet = (s: { amount: number | null; gross_amount: number | null; net_amount: number | null; currency: string | null }) =>
            convertCurrencyAmount(Number(s.net_amount) || Number(s.gross_amount) || Number(s.amount) || 0, s.currency, reportCurrency, rates) ?? 0;

          const approvedSales = (sales || []).filter((s) => isApprovedSaleStatus(s.status));
          const refundSales = (sales || []).filter((s) => isRefundedSaleStatus(s.status));

          const totalRevenue = approvedSales.reduce((acc, s) => acc + converted(s), 0);
          const totalNetRevenue = approvedSales.reduce((acc, s) => acc + convertedNet(s), 0);
          const totalRefunded = refundSales.reduce((acc, s) => acc + converted(s), 0);
          const ticketMedio = approvedSales.length ? totalRevenue / approvedSales.length : 0;

          const { data: insights } = await service
            .from("utm_insights")
            .select("spend, clicks, impressions, day, currency")
            .eq("workspace_id", workspaceId)
            .gte("day", startDate.toISOString().slice(0, 10))
            .lte("day", now.toISOString().slice(0, 10));

          const totalSpend = insights?.reduce((acc, i) => acc + (convertCurrencyAmount(Number(i.spend) || 0, i.currency, reportCurrency, rates) ?? 0), 0) || 0;
          const totalClicks = insights?.reduce((acc, i) => acc + (Number(i.clicks) || 0), 0) || 0;
          const roas = totalSpend > 0 ? totalRevenue / totalSpend : totalRevenue > 0 ? 999 : 0;

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    periodo: period,
                    moeda: reportCurrency || "várias",
                    faturamento_bruto: `${reportCurrency || ""} ${totalRevenue.toFixed(2)}`.trim(),
                    faturamento_liquido: `${reportCurrency || ""} ${totalNetRevenue.toFixed(2)}`.trim(),
                    vendas_aprovadas: approvedSales.length,
                    reembolsos_quantidade: refundSales.length,
                    valor_reembolsado: `${reportCurrency || ""} ${totalRefunded.toFixed(2)}`.trim(),
                    taxa_reembolso: approvedSales.length ? `${((refundSales.length / approvedSales.length) * 100).toFixed(1)}%` : "0%",
                    ticket_medio: `${reportCurrency || ""} ${ticketMedio.toFixed(2)}`.trim(),
                    gasto_anuncios: `${reportCurrency || ""} ${totalSpend.toFixed(2)}`.trim(),
                    cliques_anuncios: totalClicks,
                    roas: `${roas.toFixed(2)}x`,
                    lucro_estimado: `${reportCurrency || ""} ${(totalNetRevenue - totalSpend).toFixed(2)}`.trim(),
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        case "list_campaigns": {
          const { data: entities } = await service
            .from("utm_ad_entities")
            .select("integration_id, external_id, name, kind, status")
            .eq("workspace_id", workspaceId)
            .eq("kind", "campaign")
            .order("name", { ascending: true })
            .limit(25);

          const { data: insights } = await service
            .from("utm_insights")
            .select("integration_id, campaign_id, spend, clicks, impressions, currency")
            .eq("workspace_id", workspaceId);

          const { data: integrations } = await service
            .from("utm_integrations")
            .select("id, provider, currency")
            .eq("workspace_id", workspaceId);
          const providerByIntegration = new Map((integrations || []).map((i) => [i.id, i.provider]));

          const insightsMap = new Map<string, { spend: number; clicks: number }>();
          insights?.forEach((ins) => {
            const key = `${ins.integration_id}:${ins.campaign_id}`;
            const current = insightsMap.get(key) || { spend: 0, clicks: 0 };
            current.spend += Number(ins.spend) || 0;
            current.clicks += Number(ins.clicks) || 0;
            insightsMap.set(key, current);
          });

          const formatted = (entities || []).map((ent) => {
            const ins = insightsMap.get(`${ent.integration_id}:${ent.external_id}`) || { spend: 0, clicks: 0 };
            return {
              id: ent.external_id,
              nome: ent.name,
              plataforma: providerByIntegration.get(ent.integration_id) || "desconhecida",
              status: ent.status,
              gasto: `${integrations?.find((i) => i.id === ent.integration_id)?.currency || ""} ${ins.spend.toFixed(2)}`.trim(),
              cliques: ins.clicks,
            };
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(formatted, null, 2),
              },
            ],
          };
        }

        case "list_offers": {
          const { data: offers } = await service
            .from("utm_offers")
            .select("id, name, landing_url, checkout_url, currency, product_type, platform")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(offers || [], null, 2),
              },
            ],
          };
        }

        case "create_tracking_link": {
          const offerId = String(args.offer_id);
          const linkName = String(args.name);
          const utmSource = String(args.utm_source);

          const { data: offer } = await service
            .from("utm_offers")
            .select("id, landing_url, public_key")
            .eq("workspace_id", workspaceId)
            .eq("id", offerId)
            .single();

          if (!offer) {
            throw new Error(`Oferta ${offerId} não encontrada neste workspace.`);
          }

          const params: Record<string, string> = {
            utm_source: utmSource,
          };
          if (args.utm_medium) params.utm_medium = String(args.utm_medium);
          if (args.utm_campaign) params.utm_campaign = String(args.utm_campaign);
          if (args.utm_content) params.utm_content = String(args.utm_content);
          if (args.utm_term) params.utm_term = String(args.utm_term);

          const search = new URLSearchParams(params).toString();
          const targetUrl = offer.landing_url ? `${offer.landing_url}${offer.landing_url.includes("?") ? "&" : "?"}${search}` : "";
          const linkKey = randomBytes(4).toString("hex");

          const { data: link, error } = await service
            .from("utm_links")
            .insert({
              workspace_id: workspaceId,
              offer_id: offer.id,
              name: linkName,
              url: targetUrl,
              params,
              public_key: linkKey,
              active: true,
            })
            .select("id, name, url, public_key, created_at")
            .single();

          if (error) {
            throw new Error(`Erro ao criar link de rastreamento: ${error.message}`);
          }

          const appUrl = process.env.APP_URL || "https://trackbase.com.br";
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    mensagem: "Link de rastreamento criado com sucesso!",
                    id: link.id,
                    nome: link.name,
                    url_completa_com_utms: link.url,
                    link_encurtado: `${appUrl}/s/${link.public_key}`,
                    utms: params,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        case "get_recent_sales": {
          const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 50);
          const { data: sales } = await service
            .from("utm_sales")
            .select("id, transaction_id, amount, gross_amount, currency, status, product_type, provider, attribution, occurred_at")
            .eq("workspace_id", workspaceId)
            .order("occurred_at", { ascending: false })
            .limit(limit);

          const masked = (sales || []).map((s) => ({
            id: s.id,
            transacao: s.transaction_id,
            valor: `${s.currency || "BRL"} ${(Number(s.gross_amount) || Number(s.amount) || 0).toFixed(2)}`,
            status: s.status,
            tipo_produto: s.product_type || "main",
            gateway: s.provider || "desconhecido",
            origem_utm: s.attribution?.utm_source || "direto",
            campanha_utm: s.attribution?.utm_campaign || "-",
            data: s.occurred_at,
          }));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(masked, null, 2),
              },
            ],
          };
        }

        case "get_mined_offers": {
          const query = String(args.query || "").trim();
          let dbQuery = service
            .from("utm_mined_offers")
            .select("id, advertiser, niche, days_active, capture, notes, tags, created_at")
            .eq("workspace_id", workspaceId)
            .order("days_active", { ascending: false })
            .limit(10);

          if (query) {
            dbQuery = dbQuery.ilike("advertiser", `%${query}%`);
          }

          const { data: mined } = await dbQuery;
          const formatted = (mined || []).map((m) => {
            const cap = (m.capture && typeof m.capture === "object" ? m.capture : {}) as Record<string, unknown>;
            return {
              id: m.id,
              anunciante: m.advertiser,
              nicho: m.niche,
              dias_ativo: m.days_active,
              titulo: cap.title || cap.headline || "-",
              texto_anuncio: cap.body || cap.text || "-",
              tags: m.tags,
            };
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(formatted, null, 2),
              },
            ],
          };
        }

        default:
          throw new Error(`Tool desconhecida: ${toolName}`);
      }
    }

    default:
      throw new Error(`Método MCP desconhecido: ${method}`);
  }
}
