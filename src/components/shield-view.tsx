"use client";

import { useState, useTransition } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Plus,
  Copy,
  Check,
  Globe,
  Trash2,
  ExternalLink,
  Bot,
  UserCheck,
  Ghost,
  Settings,
  Lock,
} from "lucide-react";
import {
  createShield,
  updateShield,
  toggleShield,
  deleteShield,
} from "@/app/actions";
import type { Offer, ShieldRow, ShieldLogRow } from "@/lib/types";

interface Props {
  workspaceId: string;
  offers: Offer[];
  shields: ShieldRow[];
  logs: ShieldLogRow[];
  appUrl: string;
}

export function ShieldView({
  workspaceId,
  offers,
  shields,
  logs,
  appUrl,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingShield, setEditingShield] = useState<ShieldRow | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"links" | "logs">("links");

  // Estatísticas agregadas dos logs
  const totalLogs = logs.length;
  const blackCount = logs.filter((l) => l.verdict === "black").length;
  const grayCount = logs.filter((l) => l.verdict === "gray").length;
  const whiteCount = logs.filter((l) => l.verdict === "white").length;

  const blackPercent = totalLogs ? Math.round((blackCount / totalLogs) * 100) : 0;
  const grayPercent = totalLogs ? Math.round((grayCount / totalLogs) * 100) : 0;
  const whitePercent = totalLogs ? Math.round((whiteCount / totalLogs) * 100) : 0;

  function copyToClipboard(slug: string) {
    const fullUrl = `${appUrl}/s/${slug}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2500);
  }

  function handleOpenCreate() {
    setEditingShield(null);
    setErrorMsg(null);
    setShowModal(true);
  }

  function handleOpenEdit(s: ShieldRow) {
    setEditingShield(s);
    setErrorMsg(null);
    setShowModal(true);
  }

  function handleToggle(s: ShieldRow) {
    startTransition(async () => {
      await toggleShield(workspaceId, s.id, !s.active);
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir esta blindagem? O link deixará de responder.")) {
      return;
    }
    startTransition(async () => {
      await deleteShield(workspaceId, id);
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    const form = new FormData(e.currentTarget);

    startTransition(async () => {
      let res;
      if (editingShield) {
        res = await updateShield(workspaceId, editingShield.id, form);
      } else {
        res = await createShield(workspaceId, form);
      }

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setShowModal(false);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Top Banner Explicativo */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-950 border border-emerald-500/20 p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              Tecnologia Cloaking Zero-Redirect & Anti-Spy
            </div>
            <h2 className="text-xl font-bold text-zinc-100">
              Proteja sua oferta de ser clonada e espionada
            </h2>
            <p className="text-sm text-zinc-400 max-w-2xl">
              Nossa tecnologia de borda inspeciona cada requisição em menos de 10ms.
              Robôs e revisores veem a <span className="text-white font-medium">White Page</span>, 
              ferramentas de espionagem (AdHeart) e concorrentes caem na <span className="text-amber-400 font-medium">Gray Page (Isca)</span>, 
              e apenas leads humanos reais acessam sua <span className="text-emerald-400 font-medium">Black Page (VSL)</span>.
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all shadow-lg shadow-emerald-900/30 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Nova Blindagem
          </button>
        </div>

        {/* Métricas Rápidas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t border-zinc-800/80">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-zinc-400">Leads Reais (Black)</div>
              <div className="text-lg font-bold text-zinc-100">
                {blackCount} <span className="text-xs text-emerald-400 font-normal">({blackPercent}%)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0">
              <Ghost className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-zinc-400">Espiões Neutralizados (Gray)</div>
              <div className="text-lg font-bold text-zinc-100">
                {grayCount} <span className="text-xs text-amber-400 font-normal">({grayPercent}%)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-zinc-400">Auditores & Bots (White)</div>
              <div className="text-lg font-bold text-zinc-100">
                {whiteCount} <span className="text-xs text-blue-400 font-normal">({whitePercent}%)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-navegação */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab("links")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeSubTab === "links"
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Links Blindados ({shields.length})
          </button>
          <button
            onClick={() => setActiveSubTab("logs")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeSubTab === "logs"
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Feed de Bloqueios & Logs ({logs.length})
          </button>
        </div>
      </div>

      {/* Lista de Links Blindados */}
      {activeSubTab === "links" && (
        <div className="space-y-4">
          {shields.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-zinc-800 rounded-2xl p-8">
              <ShieldAlert className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <h3 className="text-zinc-200 font-semibold mb-1">Nenhum link blindado ativo</h3>
              <p className="text-zinc-500 text-sm max-w-md mx-auto mb-4">
                Crie seu primeiro link protegido com Zero-Redirect para rodar suas campanhas sem medo de espionagem ou cópias.
              </p>
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Criar Blindagem Agora
              </button>
            </div>
          ) : (
            shields.map((s) => {
              const publicUrl = `${appUrl}/s/${s.slug}`;
              const offerName = offers.find((o) => o.id === s.offer_id)?.name || "Oferta";

              return (
                <div
                  key={s.id}
                  className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition-all space-y-4"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          s.active ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"
                        }`}
                      />
                      <div>
                        <h4 className="text-zinc-100 font-semibold text-base">{s.name}</h4>
                        <span className="text-xs text-zinc-500">
                          Vinculado a: <span className="text-zinc-300">{offerName}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggle(s)}
                        disabled={isPending}
                        className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
                          s.active
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                            : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700"
                        }`}
                      >
                        {s.active ? "Blindagem Ativa" : "Pausado"}
                      </button>
                      <button
                        onClick={() => handleOpenEdit(s)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                        title="Configurações"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        disabled={isPending}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* URL do Anúncio (Pública) */}
                  <div className="flex items-center gap-2 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80">
                    <Globe className="w-4 h-4 text-emerald-400 shrink-0 ml-1" />
                    <input
                      type="text"
                      readOnly
                      value={publicUrl}
                      className="bg-transparent text-sm text-zinc-300 font-mono flex-1 outline-none select-all"
                    />
                    <button
                      onClick={() => copyToClipboard(s.slug)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors shrink-0"
                    >
                      {copiedSlug === s.slug ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copiar Link de Anúncio
                        </>
                      )}
                    </button>
                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                      title="Testar no Navegador"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>

                  {/* As 3 Camadas de Destino */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                    <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-1">
                      <div className="flex items-center gap-1.5 font-medium text-zinc-300">
                        <span className="w-2 h-2 rounded-full bg-blue-400" />
                        White Page (Revisores)
                      </div>
                      <div className="text-zinc-500 truncate font-mono" title={s.white_url}>
                        {s.white_url}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-1">
                      <div className="flex items-center gap-1.5 font-medium text-amber-400">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        Gray Page (Isca Anti-Spy)
                      </div>
                      <div className="text-zinc-500 truncate font-mono" title={s.gray_url}>
                        {s.gray_url}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-1">
                      <div className="flex items-center gap-1.5 font-medium text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        Black Page (VSL Real)
                      </div>
                      <div className="text-zinc-500 truncate font-mono" title={s.black_url}>
                        {s.black_url}
                      </div>
                    </div>
                  </div>

                  {/* Badges de Regras Ativas */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {s.block_datacenters && (
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-emerald-400" />
                        Anti-Datacenter
                      </span>
                    )}
                    {s.require_click_id && (
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-emerald-400" />
                        Exige Click ID (fbclid)
                      </span>
                    )}
                    {s.block_unknown_user_agents && (
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-emerald-400" />
                        Anti-Headless & Scraper
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Feed de Logs */}
      {activeSubTab === "logs" && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-sm">
              Nenhum acesso registrado ainda. Assim que seus links blindados receberem tráfego, as decisões do Shield aparecerão aqui em tempo real.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-950/80 border-b border-zinc-800 text-zinc-400">
                  <tr>
                    <th className="p-3">Data/Hora</th>
                    <th className="p-3">Veredito</th>
                    <th className="p-3">Motivo da Decisão</th>
                    <th className="p-3">IP (LGPD)</th>
                    <th className="p-3">Data Center?</th>
                    <th className="p-3">User-Agent / Dispositivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {logs.slice(0, 50).map((l) => (
                    <tr key={l.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="p-3 whitespace-nowrap text-zinc-400">
                        {new Date(l.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {l.verdict === "black" && (
                          <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                            BLACK (Lead Real)
                          </span>
                        )}
                        {l.verdict === "gray" && (
                          <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-400 font-semibold border border-amber-500/20">
                            GRAY (Isca / Espião)
                          </span>
                        )}
                        {l.verdict === "white" && (
                          <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/20">
                            WHITE (Revisor)
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-zinc-200 font-medium">{l.reason}</td>
                      <td className="p-3 font-mono text-zinc-400">{l.ip_masked || "-"}</td>
                      <td className="p-3">
                        {l.is_datacenter ? (
                          <span className="text-amber-400 font-medium">Sim (Cloud/Proxy)</span>
                        ) : (
                          <span className="text-zinc-500">Não (Residencial)</span>
                        )}
                      </td>
                      <td className="p-3 max-w-xs truncate text-zinc-500" title={l.user_agent || ""}>
                        {l.user_agent || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Criar / Editar Blindagem */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-zinc-100 font-bold text-lg">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                {editingShield ? "Editar Blindagem" : "Nova Blindagem de Oferta"}
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Nome da Campanha
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    defaultValue={editingShield?.name || ""}
                    placeholder="Ex: VSL Nutra Escala"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-zinc-200 outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Oferta Vinculada
                  </label>
                  <select
                    name="offer_id"
                    required
                    defaultValue={editingShield?.offer_id || offers[0]?.id || ""}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-zinc-200 outline-none focus:border-emerald-500"
                  >
                    {offers.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Slug do Link (Zero-Redirect)
                </label>
                <div className="flex items-center rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 focus-within:border-emerald-500">
                  <span className="text-zinc-500 text-xs font-mono mr-1">
                    {appUrl}/s/
                  </span>
                  <input
                    type="text"
                    name="slug"
                    required
                    defaultValue={editingShield?.slug || ""}
                    placeholder="promo-segura-2026"
                    className="bg-transparent text-sm text-zinc-200 font-mono outline-none flex-1"
                  />
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Esta é a URL única que você vai colocar no anúncio do Facebook/TikTok/Google.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-medium text-blue-400 mb-1">
                    1. URL da White Page (Página Segura para Revisores da Meta/Google)
                  </label>
                  <input
                    type="url"
                    name="white_url"
                    required
                    defaultValue={editingShield?.white_url || ""}
                    placeholder="https://meublog.com/artigo-educativo"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-zinc-200 outline-none focus:border-blue-500 font-mono"
                  />
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Artigo de blog neutro, termos de serviço ou portal de notícias 100% complacente com as regras.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-amber-400 mb-1">
                    2. URL da Gray Page (Isca para Espiões & Concorrentes)
                  </label>
                  <input
                    type="url"
                    name="gray_url"
                    required
                    defaultValue={editingShield?.gray_url || ""}
                    placeholder="https://meusite.com/ebook-gratis-isca"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-zinc-200 outline-none focus:border-amber-500 font-mono"
                  />
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Página alternativa/isca que scrapers e robôs de spy tools vão copiar achando que é sua oferta real.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-emerald-400 mb-1">
                    3. URL da Black Page (Sua VSL Real de Alta Conversão)
                  </label>
                  <input
                    type="url"
                    name="black_url"
                    required
                    defaultValue={editingShield?.black_url || ""}
                    placeholder="https://oferta-secreta.com/vsl"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-zinc-200 outline-none focus:border-emerald-500 font-mono"
                  />
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Sua página de vendas verdadeira hospedada onde você quiser (WordPress, Webflow, Atomicat, etc.).
                  </p>
                </div>
              </div>

              {/* Toggles de Proteção */}
              <div className="pt-2 border-t border-zinc-800 space-y-2">
                <span className="text-xs font-semibold text-zinc-300">Regras de Segurança:</span>

                <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    name="block_datacenters"
                    defaultChecked={editingShield ? editingShield.block_datacenters : true}
                    className="rounded border-zinc-700 bg-zinc-950 text-emerald-500"
                  />
                  <span>
                    <strong>Bloquear Data Centers:</strong> Entrega a Gray Page para qualquer IP de servidor (AWS, Google Cloud, DigitalOcean, Hetzner, etc.).
                  </span>
                </label>

                <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    name="require_click_id"
                    defaultChecked={editingShield ? editingShield.require_click_id : true}
                    className="rounded border-zinc-700 bg-zinc-950 text-emerald-500"
                  />
                  <span>
                    <strong>Exigir Click ID:</strong> Entrega a Black Page somente se o clique trouxer <code>fbclid</code>, <code>gclid</code> ou token de anúncio.
                  </span>
                </label>

                <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    name="block_unknown_user_agents"
                    defaultChecked={editingShield ? editingShield.block_unknown_user_agents : true}
                    className="rounded border-zinc-700 bg-zinc-950 text-emerald-500"
                  />
                  <span>
                    <strong>Bloquear Headless & Scrapers:</strong> Detecta robôs de espionagem (AdHeart) e navegadores simulados (Puppeteer/Playwright).
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-sm text-zinc-400 hover:text-zinc-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all disabled:opacity-50"
                >
                  {isPending ? "Salvando..." : editingShield ? "Salvar Alterações" : "Criar Blindagem"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
