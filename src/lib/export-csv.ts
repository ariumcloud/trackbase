import type { SaleRow, InsightRow, Entity, LinkRow } from "./types";
import { buildLink } from "./utm";

function downloadCsv(filename: string, content: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return '""';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

export function exportSalesCsv(sales: SaleRow[], filename = "vendas-kirofy.csv") {
  const headers = [
    "ID Transação",
    "Data / Hora",
    "Plataforma",
    "Status",
    "Tipo de Produto",
    "Valor Bruto",
    "Taxas",
    "Valor Líquido",
    "Moeda",
    "País",
    "UTM Source",
    "UTM Medium",
    "UTM Campaign",
    "UTM Content",
    "UTM Term",
    "SRC",
  ];

  const rows = sales.map((s) => {
    const d = new Date(s.occurred_at).toLocaleString("pt-BR");
    const gross = s.gross_amount ?? s.amount ?? 0;
    const fee = s.fee_amount ?? 0;
    const net = s.net_amount ?? (gross - fee);
    const attr = s.attribution || {};

    return [
      escapeCsv(s.id),
      escapeCsv(d),
      escapeCsv(s.provider.toUpperCase()),
      escapeCsv(s.status),
      escapeCsv(s.product_type || "main"),
      escapeCsv(Number(gross).toFixed(2)),
      escapeCsv(Number(fee).toFixed(2)),
      escapeCsv(Number(net).toFixed(2)),
      escapeCsv(s.currency || "BRL"),
      escapeCsv(s.country || "BR"),
      escapeCsv(attr.utm_source || ""),
      escapeCsv(attr.utm_medium || ""),
      escapeCsv(attr.utm_campaign || ""),
      escapeCsv(attr.utm_content || ""),
      escapeCsv(attr.utm_term || ""),
      escapeCsv(attr.src || attr.sck || ""),
    ].join(";");
  });

  const csvContent = [headers.join(";"), ...rows].join("\r\n");
  downloadCsv(filename, csvContent);
}

export function exportCampaignsCsv(
  insights: InsightRow[],
  entities: Entity[],
  filename = "campanhas-kirofy.csv",
) {
  const entityMap = new Map(entities.map((e) => [e.external_id, e.name]));
  const headers = [
    "Data",
    "ID Campanha",
    "Nome da Entidade",
    "Investimento (R$)",
    "Impressões",
    "Cliques",
    "CPC Médio",
    "CTR (%)",
  ];

  const rows = insights.map((i) => {
    const name = entityMap.get(i.campaign_id) || entityMap.get(i.ad_id) || i.campaign_id;
    const spend = Number(i.spend || 0);
    const clicks = Number(i.clicks || 0);
    const imp = Number(i.impressions || 0);
    const cpc = clicks > 0 ? (spend / clicks).toFixed(2) : "0.00";
    const ctr = imp > 0 ? ((clicks / imp) * 100).toFixed(2) : "0.00";

    return [
      escapeCsv(i.day),
      escapeCsv(i.campaign_id),
      escapeCsv(name),
      escapeCsv(spend.toFixed(2)),
      escapeCsv(imp),
      escapeCsv(clicks),
      escapeCsv(cpc),
      escapeCsv(ctr),
    ].join(";");
  });

  const csvContent = [headers.join(";"), ...rows].join("\r\n");
  downloadCsv(filename, csvContent);
}

export function exportLinksCsv(
  links: LinkRow[],
  appUrl: string,
  filename = "links-utm-kirofy.csv",
) {
  const headers = [
    "ID Link",
    "Nome",
    "URL Destino",
    "Link com UTMs",
    "UTM Source",
    "UTM Medium",
    "UTM Campaign",
    "UTM Content",
    "UTM Term",
    "Status",
  ];

  const rows = links.map((l) => {
    const fullUrl = buildLink(l.url, l.params || {});
    return [
      escapeCsv(l.id),
      escapeCsv(l.name),
      escapeCsv(l.url),
      escapeCsv(fullUrl),
      escapeCsv(l.params?.utm_source || ""),
      escapeCsv(l.params?.utm_medium || ""),
      escapeCsv(l.params?.utm_campaign || ""),
      escapeCsv(l.params?.utm_content || ""),
      escapeCsv(l.params?.utm_term || ""),
      escapeCsv(l.active ? "Ativo" : "Inativo"),
    ].join(";");
  });

  const csvContent = [headers.join(";"), ...rows].join("\r\n");
  downloadCsv(filename, csvContent);
}
