"use client";
/* Remote captured media must load directly, never through the server image optimizer. */
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState } from "react";
import {
  Search,
  X,
  Activity,
  Puzzle,
  Eye,
  ExternalLink,
  Download,
  Copy,
  Check,
  Flame,
  Sparkles,
  Globe,
  Folder,
  Trash2,
  Archive,
  Save,
  RefreshCw,
  ImageIcon,
  Film,
  ArrowLeft,
  Megaphone,
  UserCheck,
  FileText,
} from "lucide-react";
import type { Analysis, MinedOffer, Monitor } from "@/lib/mining/schema";
import { publicUrl } from "@/lib/mining/schema";
import "./mining.css";

async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  const r = await fetch(`/api/mining/${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Não foi possível concluir.");
  return data;
}
const date = (v: string | null) =>
  v ? new Date(v).toLocaleString("pt-BR") : "Não disponível";
const formats: Record<string, string> = {
  image: "Imagem",
  video: "Vídeo",
  carousel: "Carrossel",
  dynamic: "Dinâmico",
  unknown: "Não identificado",
};
type Grant = {
  id: string;
  workspace_id: string;
  status: string;
  expires_at: string;
};
export function ExtensionSettings({ workspace }: { workspace: string }) {
  const [grants, setGrants] = useState<Grant[]>([]),
    [challenge, setChallenge] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const r = await api<{ grants: Grant[] }>("extension");
      setGrants(r.grants.filter((g) => g.workspace_id === workspace));
    } catch (e) {
      setMessage((e as Error).message);
    }
  }, [workspace]);
  useEffect(() => {
    void load();
    const hash = new URLSearchParams(window.location.hash.slice(1)).get(
      "extension",
    );
    if (hash) {
      setChallenge(hash);
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }
  }, [load]);
  const act = async (method: string, value: unknown) => {
    setBusy(true);
    setMessage("");
    try {
      await api("extension", method, value);
      setMessage(
        method === "POST"
          ? "Workspace autorizado com sucesso! Agora basta abrir o popup da extensão para concluir a conexão."
          : "Autorização revogada.",
      );
      setChallenge("");
      await load();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mining-panel">
      <h2>Extensão Trackbase</h2>
      <p>
        Baixe o pacote oficial do Trackbase e siga o passo a passo abaixo para
        conectar a extensão a este workspace.
      </p>
      <div className="mining-actions">
        <a
          className="button primary"
          href="/downloads/trackbase-extension.zip"
          download
        >
          ⬇ Baixar extensão do Trackbase
        </a>
      </div>
      <details className="extension-install-help" open>
        <summary>Como instalar no Chrome</summary>
        <ol>
          <li>Baixe o arquivo e extraia o conteúdo do ZIP em uma pasta.</li>
          <li>Abra <code>chrome://extensions</code> em uma nova aba.</li>
          <li>Ative o <strong>Modo do desenvolvedor</strong>.</li>
          <li>Clique em <strong>Carregar sem compactação</strong> e selecione a pasta extraída.</li>
          <li>Abra a extensão Trackbase, clique em <strong>Iniciar vínculo</strong> e copie o código.</li>
          <li>Cole o código abaixo e autorize este workspace.</li>
          <li>Volte à extensão e clique em <strong>Concluir vínculo</strong>.</li>
        </ol>
      </details>
      <label>
        Código de vínculo
        <input
          value={challenge}
          onChange={(e) => setChallenge(e.target.value)}
          placeholder="Cole o código mostrado pela extensão"
          autoComplete="off"
        />
      </label>
      <button
        className="button"
        disabled={busy || !/^[a-f0-9]{64}$/.test(challenge)}
        onClick={() => void act("POST", { workspace, challenge })}
      >
        Autorizar extensão neste workspace
      </button>
      {message && <p role="status">{message}</p>}
      <div className="mining-status-container">
        <h4 className="mining-status-title">Status do vínculo com a extensão</h4>
        {!grants.some(
          (g) => g.status === "active" && Date.parse(g.expires_at) > Date.now(),
        ) && (
          <div className="mining-status-badge inactive">
            <span className="mining-status-icon">⚠️</span>
            <div>
              <strong>Nenhuma autorização ativa</strong>
              <p>
                Cole o código gerado pela extensão acima e clique em autorizar para conectar este workspace.
              </p>
            </div>
          </div>
        )}
        {grants
          .filter((g) => g.status !== "revoked")
          .map((g) => {
            const isExpired = Date.parse(g.expires_at) <= Date.now();
            const isPending = g.status === "pending";
            const statusClass = isExpired ? "expired" : isPending ? "pending" : "active";
            const statusLabel = isExpired ? "Expirado" : isPending ? "Pendente" : "Ativo";
            const statusText = isExpired
              ? "Autorização expirada"
              : isPending
                ? "Aguardando confirmação na extensão"
                : "Extensão conectada e autorizada";

            return (
              <div className={`mining-status-item ${statusClass}`} key={g.id}>
                <div className="mining-status-info">
                  <span className={`mining-status-pill ${statusClass}`}>
                    {statusLabel}
                  </span>
                  <div className="mining-status-meta">
                    <strong>{statusText}</strong>
                    <span>Válido até {date(g.expires_at)}</span>
                  </div>
                </div>
                <button
                  className="button secondary"
                  style={{ padding: "6px 12px", fontSize: "12px" }}
                  disabled={busy}
                  onClick={() => void act("DELETE", { workspace, id: g.id })}
                >
                  Revogar
                </button>
              </div>
            );
          })}
      </div>
    </section>
  );
}
type History = {
  snapshots: {
    id: string;
    capture: MinedOffer["capture"];
    captured_at: string;
  }[];
  changes: {
    id: string;
    created_at: string;
    differences: { field: string; before: unknown; after: unknown }[];
  }[];
  analyses: {
    id: string;
    status: string;
    result: Analysis | null;
    error: string | null;
    created_at: string;
  }[];
  runs: {
    id: string;
    status: string;
    error: string | null;
    created_at: string;
  }[];
  count: number;
};
function OfferDetails({
  offer,
  close,
  changed,
}: {
  offer: MinedOffer;
  close: () => void;
  changed: () => void;
}) {
  const [history, setHistory] = useState<History | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [analyzing, setAnalyzing] = useState(false),
    [historyPage, setHistoryPage] = useState(0);
  const [tags, setTags] = useState(offer.tags.join(", ")),
    [notes, setNotes] = useState(offer.notes),
    [niche, setNiche] = useState(offer.niche),
    [status, setStatus] = useState(offer.status);
  const [copiedCopy, setCopiedCopy] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [activeMediaIdx, setActiveMediaIdx] = useState(0);

  const path = `offers/${offer.id}`,
    query = `workspace=${offer.workspace_id}`;
  const load = useCallback(async () => {
    try {
      setHistory(
        await api<History>(
          `offers/${offer.id}/history?workspace=${offer.workspace_id}&page=${historyPage}`,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }, [offer.id, offer.workspace_id, historyPage]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<unknown>) => {
    setError("");
    setBusy(true);
    try {
      await action();
      await load();
      changed();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copyCopy = async () => {
    if (!offer.capture.copy) return;
    try {
      await navigator.clipboard.writeText(offer.capture.copy);
      setCopiedCopy(true);
      setTimeout(() => setCopiedCopy(false), 2000);
    } catch {}
  };

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(offer.library_id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {}
  };

  const currentMedia =
    offer.capture.media && offer.capture.media.length > 0
      ? offer.capture.media[activeMediaIdx] || offer.capture.media[0]
      : null;

  return (
    <div className="mining-studio" aria-label="Detalhes da oferta">
      {/* Studio Topbar */}
      <div className="mining-studio-topbar">
        <div className="mining-card-author">
          <button
            className="mining-studio-back-btn"
            onClick={close}
            title="Voltar para a lista de anúncios"
          >
            <ArrowLeft size={15} /> Voltar à lista
          </button>
          <div className="mining-studio-heading">
            <h2 className="mining-studio-title">
              {offer.advertiser}
              <button
                className="mining-studio-id-badge"
                onClick={() => void copyId()}
                title="Clique para copiar ID da Biblioteca Meta"
              >
                {copiedId ? "ID copiado!" : `ID #${offer.library_id}`}
              </button>
            </h2>
            <span style={{ fontSize: "12px", color: "var(--muted, #64748b)" }}>
              {offer.capture.page_name || "Página na Meta"} · Salvo em{" "}
              {date(offer.created_at)}
            </span>
          </div>
        </div>

        <div className="mining-studio-actions">
          {offer.library_url && publicUrl(offer.library_url) && (
            <a
              className="mining-btn-primary"
              style={{ background: "#1877f2" }}
              href={offer.library_url}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir anúncio oficial na Biblioteca de Anúncios da Meta"
            >
              <ExternalLink size={14} /> Ver na Meta Ads Library
            </a>
          )}
          {offer.capture.landing_url && publicUrl(offer.capture.landing_url) && (
            <a
              className="mining-strategy-btn"
              href={offer.capture.landing_url}
              target="_blank"
              rel="noopener noreferrer"
              title="Visitar página de destino capturada"
            >
              <Globe size={14} /> Página de Destino
            </a>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" style={{ color: "#ef4444", margin: 0 }}>
          {error}
        </p>
      )}

      {/* 2-Column Studio Grid */}
      <div className="mining-studio-grid">
        {/* Left Column: Creative Media & Copy */}
        <div className="mining-studio-left">
          {/* Creative Media Showcase */}
          <div className="mining-studio-creative-card">
            <div className="mining-studio-player-wrap">
              {currentMedia && publicUrl(currentMedia.url) ? (
                currentMedia.type === "video" ? (
                  <video
                    controls
                    preload="auto"
                    src={currentMedia.url}
                    style={{ width: "100%", maxHeight: "500px" }}
                  />
                ) : (
                  <img
                    src={currentMedia.url}
                    alt={offer.advertiser}
                    loading="eager"
                    referrerPolicy="no-referrer"
                    style={{
                      width: "100%",
                      maxHeight: "500px",
                      objectFit: "contain",
                    }}
                  />
                )
              ) : (
                <div
                  className="mining-card-no-media"
                  style={{ padding: "60px 20px" }}
                >
                  <ImageIcon size={48} />
                  <span>Sem arquivo de mídia salvo para esta captura.</span>
                </div>
              )}
            </div>

            {/* Media Carousel selector if multiple media */}
            {offer.capture.media && offer.capture.media.length > 1 && (
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  overflowX: "auto",
                  padding: "4px 0",
                }}
              >
                {offer.capture.media.map((m, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveMediaIdx(idx)}
                    style={{
                      border:
                        idx === activeMediaIdx
                          ? "2px solid #5b34ea"
                          : "1px solid var(--border, #e2e8f0)",
                      borderRadius: "8px",
                      overflow: "hidden",
                      width: "56px",
                      height: "56px",
                      padding: 0,
                      background: "#000",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    {m.type === "video" ? (
                      <video
                        src={m.url}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <img
                        src={m.url}
                        alt={`Thumb ${idx}`}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Creative Toolbar */}
            <div className="mining-studio-toolbar">
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {currentMedia && publicUrl(currentMedia.url) && (
                  <>
                    <a
                      className="mining-btn-primary"
                      href={currentMedia.url}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download size={14} /> Baixar criativo
                    </a>
                    <a
                      className="mining-strategy-btn"
                      href={currentMedia.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink size={14} /> Abrir em nova aba
                    </a>
                  </>
                )}
              </div>
              <span className="mining-studio-cdn-note">
                CDN oficial da Meta · Mídia temporária
              </span>
            </div>
          </div>

          {/* Copy & Ad Text Card */}
          <div className="mining-studio-copy-card">
            <div className="mining-studio-copy-header">
              <h3 className="mining-studio-section-title">
                <FileText size={16} /> Texto & Copywriting do Anúncio
              </h3>
              {offer.capture.copy && (
                <button
                  className="mining-copy-btn"
                  onClick={() => void copyCopy()}
                  title="Copiar texto da copy"
                >
                  {copiedCopy ? (
                    <>
                      <Check size={13} color="#10b981" /> Copiado!
                    </>
                  ) : (
                    <>
                      <Copy size={13} /> Copiar texto
                    </>
                  )}
                </button>
              )}
            </div>

            {offer.capture.headline && (
              <div className="mining-headline-box">
                <span
                  style={{
                    fontSize: "11px",
                    color: "#5b34ea",
                    display: "block",
                    marginBottom: "2px",
                  }}
                >
                  HEADLINE
                </span>
                {offer.capture.headline}
              </div>
            )}

            <div className="mining-copy-text">
              {offer.capture.copy ||
                "Sem texto ou descrição capturada para este criativo."}
            </div>

            {offer.capture.copy && (
              <div className="mining-copy-footer">
                {offer.capture.copy.length} caracteres ·{" "}
                {offer.capture.copy.split(/\s+/).filter(Boolean).length} palavras
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Intelligence, Strategy & Management */}
        <div className="mining-studio-right">
          {/* Performance KPIs 2x2 Grid */}
          <div className="mining-metrics-grid">
            <div className="mining-metric-kpi">
              <span className="mining-metric-kpi-label">
                <Flame size={13} color="#ef4444" /> Dias Ativo
              </span>
              <span
                className="mining-metric-kpi-val"
                style={{ color: "#ef4444" }}
              >
                {offer.days_active ?? "?"}{" "}
                {offer.days_active === 1 ? "dia" : "dias"}
              </span>
              <span className="mining-metric-kpi-sub">
                Início: {offer.capture.start_date || "Não identificado"}
              </span>
            </div>

            <div className="mining-metric-kpi">
              <span className="mining-metric-kpi-label">
                <Activity size={13} color="#10b981" /> Status na Meta
              </span>
              <span
                className="mining-metric-kpi-val"
                style={{
                  color:
                    offer.capture.activity === "active"
                      ? "#10b981"
                      : "#64748b",
                }}
              >
                {offer.capture.activity === "active"
                  ? "Ativo"
                  : offer.capture.activity === "inactive"
                    ? "Inativo"
                    : "Desconhecido"}
              </span>
              <span className="mining-metric-kpi-sub">
                Formato: {formats[offer.capture.format]}
              </span>
            </div>

            <div className="mining-metric-kpi">
              <span className="mining-metric-kpi-label">
                <Megaphone size={13} color="#3b82f6" /> Criativos Ativos
              </span>
              <span
                className="mining-metric-kpi-val"
                style={{ color: "#3b82f6" }}
              >
                {offer.capture.related_count !== undefined &&
                offer.capture.related_count !== null
                  ? `${offer.capture.related_count} ads`
                  : "1 criativo"}
              </span>
              <span className="mining-metric-kpi-sub">
                Pelo mesmo anunciante
              </span>
            </div>

            <div className="mining-metric-kpi">
              <span className="mining-metric-kpi-label">
                <Globe size={13} color="#8b5cf6" /> Plataformas
              </span>
              <span
                className="mining-metric-kpi-val"
                style={{ fontSize: "14px", fontWeight: 700 }}
              >
                {offer.capture.platforms.length > 0
                  ? offer.capture.platforms.join(", ")
                  : "Facebook / Instagram"}
              </span>
              <span className="mining-metric-kpi-sub">
                Última captura:{" "}
                {new Date(offer.captured_at).toLocaleDateString("pt-BR")}
              </span>
            </div>
          </div>

          {/* Strategy Actions Toolbar */}
          <div className="mining-strategy-toolbar">
            <button
              className="mining-strategy-btn"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  api(`monitors?${query}`, "POST", {
                    offer_id: offer.id,
                    label: offer.advertiser,
                  }),
                )
              }
              title="Acompanhar alterações deste anúncio"
            >
              <Activity size={14} /> Monitorar oferta
            </button>

            <button
              className="mining-strategy-btn"
              disabled={busy || !offer.capture.page_id}
              title={
                !offer.capture.page_id
                  ? "Page ID não capturado nesta oferta"
                  : "Acompanhar novos anúncios desta página"
              }
              onClick={() =>
                void run(() =>
                  api(`monitors?${query}`, "POST", {
                    page_id: offer.capture.page_id,
                    label: offer.capture.page_name || offer.advertiser,
                  }),
                )
              }
            >
              <UserCheck size={14} /> Monitorar anunciante
            </button>

            <button
              className="mining-strategy-btn ai"
              disabled={busy || analyzing}
              onClick={() =>
                void run(async () => {
                  setAnalyzing(true);
                  try {
                    await api(`${path}/analysis?${query}`, "POST");
                  } finally {
                    setAnalyzing(false);
                  }
                })
              }
            >
              <Sparkles size={14} />
              {analyzing ? "Analisando…" : "Análise com IA"}
            </button>

            <button
              className="mining-strategy-btn"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  api(`${path}?${query}`, "PATCH", { status: "archived" }),
                )
              }
            >
              <Archive size={14} /> Arquivar
            </button>

            <button
              className="mining-strategy-btn danger"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    "Excluir esta oferta e todo o seu histórico de capturas?",
                  )
                )
                  void run(async () => {
                    await api(`${path}?${query}`, "DELETE", undefined, {
                      "x-confirm-delete": offer.id,
                    });
                    close();
                  });
              }}
            >
              <Trash2 size={14} /> Excluir
            </button>
          </div>

          {/* Management Form Card */}
          <div className="mining-manage-card">
            <h4 className="mining-studio-section-title">
              <Folder size={15} /> Organização & Anotações
            </h4>

            <div className="mining-manage-fields">
              <label>
                Nicho / Categoria
                <input
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  placeholder="Ex: Dropshipping, Nutracêuticos, Moda"
                  maxLength={200}
                />
              </label>

              <label>
                Tags (separadas por vírgula)
                <input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="Ex: boné, verão, escala"
                />
              </label>

              <label>
                Status da Oferta
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as MinedOffer["status"])
                  }
                >
                  <option value="saved">🟢 Salva</option>
                  <option value="reviewed">🔍 Analisada</option>
                  <option value="archived">📦 Arquivada</option>
                </select>
              </label>
            </div>

            <label>
              Observações & Insights Internos
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anotações sobre a oferta, ganchos para testar, estrutura da página de destino, etc."
                maxLength={8000}
                rows={3}
              />
            </label>

            <button
              className="mining-btn-primary"
              style={{ width: "fit-content" }}
              disabled={busy}
              onClick={() =>
                void run(() =>
                  api(`${path}?${query}`, "PATCH", {
                    niche,
                    tags: [
                      ...new Set(
                        tags
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean),
                      ),
                    ],
                    notes,
                    status,
                  }),
                )
              }
            >
              <Save size={14} /> Salvar alterações
            </button>
          </div>

          {/* AI Analysis Section */}
          <div className="mining-ai-container">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h4 className="mining-studio-section-title">
                <Sparkles size={16} color="#5b34ea" /> Análise Estratégica com IA
              </h4>
              {analyzing && (
                <span style={{ fontSize: "12px", color: "#5b34ea" }}>
                  Processando análise...
                </span>
              )}
            </div>

            {!history && (
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--muted, #64748b)",
                  margin: 0,
                }}
              >
                Carregando dados…
              </p>
            )}
            {history && !history.analyses.length && !analyzing && (
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--muted, #64748b)",
                  margin: 0,
                }}
              >
                Nenhuma análise gerada ainda. Clique no botão &ldquo;Análise com
                IA&rdquo; acima para dissecar o gancho, promessa, mecanismo e
                pontos fortes/fracos.
              </p>
            )}

            {history?.analyses.map((a) => (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "12px",
                    color: "var(--muted, #64748b)",
                  }}
                >
                  <span>Data: {date(a.created_at)}</span>
                  <span
                    style={{
                      fontWeight: 700,
                      color:
                        a.status === "completed" ? "#10b981" : "#f59e0b",
                    }}
                  >
                    {a.status === "running"
                      ? "Análise em andamento"
                      : a.status === "failed"
                        ? `Falha: ${a.error}`
                        : "✓ Concluída"}
                  </span>
                </div>
                {a.result && <AnalysisView analysis={a.result} />}
              </div>
            ))}
          </div>

          {/* Changes History & Snapshots Accordions */}
          <details className="mining-accordion">
            <summary>
              Histórico de alterações ({history?.changes.length || 0} detectadas)
            </summary>
            <div className="mining-accordion-body">
              {history && !history.changes.length && (
                <p
                  style={{
                    fontSize: "13px",
                    color: "var(--muted, #64748b)",
                    margin: 0,
                  }}
                >
                  Nenhuma mudança de copy ou mídia foi detectada nesta oferta até
                  o momento.
                </p>
              )}
              {history?.changes.map((c) => (
                <div
                  key={c.id}
                  style={{
                    borderBottom: "1px solid var(--border, #e5e7eb)",
                    paddingBottom: "10px",
                  }}
                >
                  <strong style={{ fontSize: "12px" }}>
                    {date(c.created_at)} · {c.differences.length} alterações
                  </strong>
                  {c.differences.map((d) => (
                    <div
                      key={d.field}
                      style={{ marginTop: "6px", fontSize: "12px" }}
                    >
                      <span style={{ fontWeight: 600, color: "#5b34ea" }}>
                        {d.field}:
                      </span>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "8px",
                          marginTop: "4px",
                        }}
                      >
                        <pre
                          style={{
                            margin: 0,
                            padding: "6px",
                            background: "var(--bg-elevated, #f8fafc)",
                            borderRadius: "6px",
                            fontSize: "11px",
                          }}
                        >
                          Antes: {JSON.stringify(d.before, null, 2)}
                        </pre>
                        <pre
                          style={{
                            margin: 0,
                            padding: "6px",
                            background: "var(--bg-elevated, #f8fafc)",
                            borderRadius: "6px",
                            fontSize: "11px",
                          }}
                        >
                          Depois: {JSON.stringify(d.after, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </details>

          <details className="mining-accordion">
            <summary>
              Snapshots arquivados ({history?.snapshots.length || 0} capturas)
            </summary>
            <div className="mining-accordion-body">
              {history?.snapshots.map((s) => (
                <div
                  key={s.id}
                  style={{
                    padding: "8px",
                    background: "var(--bg-elevated, #f8fafc)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                >
                  <strong>{date(s.captured_at)}</strong>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--muted, #64748b)",
                      marginTop: "2px",
                    }}
                  >
                    Headline: {s.capture.headline || "N/D"} · Mídias:{" "}
                    {s.capture.media.length} · Formato:{" "}
                    {formats[s.capture.format]}
                  </div>
                </div>
              ))}
              {history && history.count > 30 && (
                <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                  <button
                    className="button secondary"
                    disabled={historyPage === 0}
                    onClick={() => setHistoryPage((p) => p - 1)}
                  >
                    Anterior
                  </button>
                  <button
                    className="button secondary"
                    disabled={(historyPage + 1) * 30 >= history.count}
                    onClick={() => setHistoryPage((p) => p + 1)}
                  >
                    Mais histórico
                  </button>
                </div>
              )}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
function MonitorHistory({
  monitor,
  workspace,
  open,
}: {
  monitor: Monitor;
  workspace: string;
  open: (id: string) => void;
}) {
  const [rows, setRows] = useState<
      (History["runs"][number] & { offer_id?: string })[]
    >([]),
    [error, setError] = useState(""),
    [page, setPage] = useState(0),
    [count, setCount] = useState(0),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api<{
      runs: (History["runs"][number] & { offer_id?: string })[];
      count: number;
    }>(`monitors/${monitor.id}/history?workspace=${workspace}&page=${page}`)
      .then((r) => {
        if (active) {
          setRows(r.runs);
          setCount(r.count);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [monitor.id, workspace, page]);
  return (
    <details>
      <summary>Histórico de verificações e anúncios observados</summary>
      {loading && <p>Carregando…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !rows.length && <p>Nenhuma verificação registrada.</p>}
      {rows.map((r) => (
        <div className="mining-row" key={r.id}>
          <p>
            {date(r.created_at)} ·{" "}
            {r.status === "observed"
              ? "Anúncio observado"
              : `Falha: ${r.error}`}
          </p>
          {r.offer_id && (
            <button
              className="button secondary"
              onClick={() => open(r.offer_id!)}
            >
              Ver anúncio e alterações
            </button>
          )}
        </div>
      ))}
      <button
        className="button secondary"
        disabled={page === 0}
        onClick={() => setPage((p) => p - 1)}
      >
        Anterior
      </button>
      <button
        className="button secondary"
        disabled={(page + 1) * 30 >= count}
        onClick={() => setPage((p) => p + 1)}
      >
        Mais verificações
      </button>
    </details>
  );
}
function AnalysisView({ analysis }: { analysis: Analysis }) {
  const labels: Record<string, string> = {
    summary: "Resumo Estratégico",
    angle: "Ângulo de Vendas",
    hook: "Gancho Principal",
    promise: "Promessa Central",
    mechanism: "Mecanismo Único",
    audience: "Público Provável",
    awareness: "Nível de Consciência",
    proof: "Elementos de Prova",
    cta: "Chamada para Ação (CTA)",
    copy_structure: "Estrutura da Copy",
    strengths: "Pontos Fortes",
    weaknesses: "Pontos Fracos",
    longevity_hypotheses: "Hipóteses de Longevidade",
    variations: "Variações Identificadas",
    suggested_tags: "Tags Sugeridas",
    confidence: "Grau de Confiança",
  };
  return (
    <div className="mining-ai-grid">
      {Object.entries(analysis).map(([key, value]) => (
        <div className="mining-ai-item" key={key}>
          <span className="mining-ai-label">{labels[key] || key}</span>
          <div className="mining-ai-value">
            {(Array.isArray(value) ? value : [value]).map((v, i) => (
              <p key={i} style={{ margin: "2px 0" }}>
                {typeof v === "object" && v !== null
                  ? `${(v as { text: string }).text} (${(v as { basis: string }).basis === "hypothesis" ? "Hipótese" : (v as { basis: string }).basis === "observed" ? "Observado" : "N/D"})`
                  : String(v)}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
export function MiningView({ workspace }: { workspace: string }) {
  const [tab, setTab] = useState("offers"),
    [offers, setOffers] = useState<MinedOffer[]>([]),
    [monitors, setMonitors] = useState<Monitor[]>([]),
    [selected, setSelected] = useState<MinedOffer | null>(null),
    [count, setCount] = useState(0);
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0);
  const [filters, setFilters] = useState({
    q: "",
    format: "",
    status: "",
    tag: "",
    min_days: "",
    max_days: "",
    sort: "saved",
    page: "0",
  });
  useEffect(() => {
    if (window.location.hash.includes("extension=")) setTab("extension");
  }, []);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        workspace,
        ...Object.fromEntries(
          Object.entries(filters).filter(([, v]) => v !== ""),
        ),
      });
      Promise.all([
        api<{ offers: MinedOffer[]; count: number }>(`offers?${params}`),
        api<{ monitors: Monitor[] }>(`monitors?workspace=${workspace}`),
      ])
        .then(([o, m]) => {
          if (active) {
            setOffers(o.offers);
            setCount(o.count);
            setMonitors(m.monitors);
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [workspace, filters, revision]);
  const refresh = () => setRevision((v) => v + 1);
  const changeMonitor = async (m: Monitor, remove = false) => {
    setBusy(true);
    setError("");
    try {
      await api(
        `monitors?workspace=${workspace}${remove ? `&id=${m.id}` : ""}`,
        remove ? "DELETE" : "PATCH",
        remove
          ? undefined
          : { id: m.id, status: m.status === "active" ? "paused" : "active" },
      );
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const field = (name: keyof typeof filters, value: string) =>
    setFilters((f) => ({
      ...f,
      [name]: value,
      ...(name !== "page" ? { page: "0" } : {}),
    }));
  const hasActiveFilters = Boolean(
    filters.q ||
      filters.format ||
      filters.status ||
      filters.tag ||
      filters.min_days ||
      filters.max_days ||
      filters.sort !== "saved",
  );

  if (selected) {
    return (
      <div className="mining">
        <OfferDetails
          key={selected.id}
          offer={selected}
          close={() => setSelected(null)}
          changed={refresh}
        />
      </div>
    );
  }

  return (
    <div className="mining">
      <nav className="mining-nav-tabs" aria-label="Navegação da Mineração">
        <button
          className={`mining-tab-btn ${tab === "offers" ? "active" : ""}`}
          onClick={() => setTab("offers")}
        >
          <Sparkles size={15} />
          <span>Ofertas salvas</span>
          <span className="mining-tab-badge">{count}</span>
        </button>
        <button
          className={`mining-tab-btn ${tab === "monitors" ? "active" : ""}`}
          onClick={() => setTab("monitors")}
        >
          <Activity size={15} />
          <span>Monitoramento</span>
          <span className="mining-tab-badge">
            {monitors.filter((m) => m.status === "active").length}
          </span>
        </button>
        <button
          className={`mining-tab-btn ${tab === "extension" ? "active" : ""}`}
          onClick={() => setTab("extension")}
        >
          <Puzzle size={15} />
          <span>Configurar extensão</span>
        </button>
      </nav>

      {error && (
        <div role="alert" className="mining-panel" style={{ color: "#ef4444" }}>
          <span>{error}</span>
          <button className="button secondary" onClick={refresh}>
            <RefreshCw size={13} /> Tentar novamente
          </button>
        </div>
      )}

      {tab === "extension" ? (
        <ExtensionSettings key={workspace} workspace={workspace} />
      ) : (
        <>
          {loading && (
            <div style={{ padding: "16px 0", color: "var(--muted, #64748b)", fontSize: "13px" }}>
              Carregando ofertas do workspace…
            </div>
          )}

          {tab === "offers" && (
            <>
              {/* Filter Panel */}
              <div className="mining-filter-panel">
                <div className="mining-filter-row">
                  <div className="mining-search-wrap">
                    <Search size={15} className="mining-search-icon" />
                    <input
                      className="mining-search-input"
                      value={filters.q}
                      onChange={(e) => field("q", e.target.value)}
                      placeholder="Buscar por anunciante, copy, nicho ou URL..."
                    />
                  </div>

                  <div className="mining-filter-select-wrap">
                    <select
                      className="mining-filter-select"
                      value={filters.format}
                      onChange={(e) => field("format", e.target.value)}
                    >
                      <option value="">Formato: Todos</option>
                      {Object.entries(formats).map(([k, v]) => (
                        <option value={k} key={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mining-filter-select-wrap">
                    <select
                      className="mining-filter-select"
                      value={filters.status}
                      onChange={(e) => field("status", e.target.value)}
                    >
                      <option value="">Status: Todos</option>
                      <option value="saved">🟢 Salva</option>
                      <option value="reviewed">🔍 Analisada</option>
                      <option value="archived">📦 Arquivada</option>
                    </select>
                  </div>

                  <div className="mining-filter-select-wrap">
                    <select
                      className="mining-filter-select"
                      value={filters.sort}
                      onChange={(e) => field("sort", e.target.value)}
                    >
                      <option value="saved">Ordenar: Data salva</option>
                      <option value="days">Ordenar: Mais dias ativo</option>
                      <option value="advertiser">Ordenar: Anunciante</option>
                    </select>
                  </div>
                </div>

                <div className="mining-filter-extra">
                  <div className="mining-filter-item">
                    <span>Tag:</span>
                    <input
                      value={filters.tag}
                      placeholder="Filtrar tag"
                      onChange={(e) => field("tag", e.target.value)}
                      style={{ width: "110px" }}
                    />
                  </div>

                  <div className="mining-filter-item">
                    <span>Mín. dias:</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="Ex: 7"
                      value={filters.min_days}
                      onChange={(e) => field("min_days", e.target.value)}
                    />
                  </div>

                  <div className="mining-filter-item">
                    <span>Máx. dias:</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="Ex: 90"
                      value={filters.max_days}
                      onChange={(e) => field("max_days", e.target.value)}
                    />
                  </div>

                  {hasActiveFilters && (
                    <button
                      className="mining-clear-btn"
                      onClick={() =>
                        setFilters({
                          q: "",
                          format: "",
                          status: "",
                          tag: "",
                          min_days: "",
                          max_days: "",
                          sort: "saved",
                          page: "0",
                        })
                      }
                      title="Limpar todos os filtros aplicados"
                    >
                      <X size={13} /> Limpar filtros
                    </button>
                  )}
                </div>
              </div>

              {/* Empty State */}
              {!loading && !error && !offers.length && (
                <div className="mining-empty-state">
                  <div className="mining-empty-icon">
                    <Sparkles size={28} />
                  </div>
                  <h3>Nenhuma oferta encontrada</h3>
                  <p>
                    {hasActiveFilters
                      ? "Nenhum criativo corresponde aos filtros selecionados. Tente ajustar os termos de busca."
                      : "Abra a Biblioteca de Anúncios da Meta e clique em “Salvar no Trackbase” na extensão para minerar criativos."}
                  </p>
                  <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
                    {hasActiveFilters ? (
                      <button
                        className="button"
                        onClick={() =>
                          setFilters({
                            q: "",
                            format: "",
                            status: "",
                            tag: "",
                            min_days: "",
                            max_days: "",
                            sort: "saved",
                            page: "0",
                          })
                        }
                      >
                        Limpar filtros
                      </button>
                    ) : (
                      <button
                        className="button"
                        onClick={() => setTab("extension")}
                      >
                        Configurar extensão
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Cards Grid */}
              <div className="mining-grid">
                {offers.map((o) => {
                  const firstMedia =
                    o.capture.media && o.capture.media.length > 0
                      ? o.capture.media[0]
                      : null;

                  return (
                    <article className="mining-card" key={o.id}>
                      {/* Header */}
                      <div className="mining-card-header">
                        <div className="mining-card-author">
                          <div className="mining-card-avatar">
                            {o.advertiser ? o.advertiser.charAt(0).toUpperCase() : "A"}
                          </div>
                          <div className="mining-card-names">
                            <h4 className="mining-card-title" title={o.advertiser}>
                              {o.advertiser}
                            </h4>
                            <span className="mining-card-page-id">
                              {o.capture.page_name || `Biblioteca #${o.library_id}`}
                            </span>
                          </div>
                        </div>
                        <span className={`mining-status-pill-subtle ${o.status}`}>
                          {o.status === "archived"
                            ? "Arquivada"
                            : o.status === "reviewed"
                              ? "Analisada"
                              : "Salva"}
                        </span>
                      </div>

                      {/* Media Area */}
                      <div
                        className="mining-card-media"
                        onClick={() => setSelected(o)}
                        title="Clique para inspecionar criativo e métricas"
                      >
                        {o.days_active !== null && o.days_active !== undefined && (
                          <span className="mining-badge-fire">
                            <Flame size={12} /> {o.days_active} {o.days_active === 1 ? "dia" : "dias"}
                          </span>
                        )}

                        <span className="mining-badge-format">
                          {o.capture.format === "video" ? (
                            <Film size={11} />
                          ) : (
                            <ImageIcon size={11} />
                          )}
                          {formats[o.capture.format] || "Criativo"}
                        </span>

                        {Boolean(o.capture.related_count) && (
                          <span className="mining-badge-related">
                            <Megaphone size={10} /> {o.capture.related_count} ads
                          </span>
                        )}

                        {/* Media Preview or Placeholder */}
                        {firstMedia && publicUrl(firstMedia.url) ? (
                          firstMedia.type === "video" ? (
                            <video
                              className="mining-card-video"
                              src={firstMedia.url}
                              preload="metadata"
                              muted
                            />
                          ) : (
                            <img
                              className="mining-card-img"
                              src={firstMedia.url}
                              alt={o.advertiser}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                          )
                        ) : (
                          <div className="mining-card-no-media">
                            <ImageIcon size={32} />
                            <span>Sem mídia capturada</span>
                          </div>
                        )}

                        <div className="mining-card-overlay">
                          <button className="mining-overlay-action">
                            <Eye size={14} /> Inspecionar
                          </button>
                        </div>
                      </div>

                      {/* Body */}
                      <div className="mining-card-body">
                        <div className="mining-card-niche-row">
                          <span className="mining-niche-pill">
                            {o.niche ? `#${o.niche}` : "#SemNicho"}
                          </span>
                          {o.capture.activity === "active" && (
                            <span style={{ fontSize: "11px", color: "#10b981", fontWeight: 700 }}>
                              ● Ativo na Meta
                            </span>
                          )}
                        </div>

                        {o.capture.headline && (
                          <h5 className="mining-card-headline" title={o.capture.headline}>
                            {o.capture.headline}
                          </h5>
                        )}

                        <p className="mining-card-excerpt">
                          {o.capture.copy ||
                            "Sem texto ou descrição capturada para este criativo."}
                        </p>

                        {o.tags && o.tags.length > 0 && (
                          <div className="mining-card-tags">
                            {o.tags.slice(0, 3).map((t, idx) => (
                              <span className="mining-tag-chip" key={idx}>
                                #{t}
                              </span>
                            ))}
                            {o.tags.length > 3 && (
                              <span className="mining-tag-chip">
                                +{o.tags.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="mining-card-footer">
                        <span className="mining-card-footer-date">
                          {new Date(o.created_at).toLocaleDateString("pt-BR")}
                        </span>

                        <div className="mining-card-btns">
                          <button
                            className="mining-btn-primary"
                            onClick={() => setSelected(o)}
                            title="Ver todos os detalhes, métricas e análises"
                          >
                            <Eye size={13} /> Detalhes
                          </button>

                          {o.library_url && publicUrl(o.library_url) && (
                            <a
                              className="mining-btn-icon"
                              href={o.library_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Ver anúncio original na Meta Ads Library"
                            >
                              <ExternalLink size={13} />
                            </a>
                          )}

                          {firstMedia && publicUrl(firstMedia.url) && (
                            <a
                              className="mining-btn-icon"
                              href={firstMedia.url}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Baixar criativo"
                            >
                              <Download size={13} />
                            </a>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Pagination */}
              {count > 30 && (
                <div className="mining-pagination">
                  <button
                    className="button secondary"
                    disabled={+filters.page === 0 || loading}
                    onClick={() => field("page", String(+filters.page - 1))}
                  >
                    Anterior
                  </button>
                  <span className="mining-pagination-info">
                    Página {+filters.page + 1} de{" "}
                    {Math.max(1, Math.ceil(count / 30))} · {count} ofertas
                  </span>
                  <button
                    className="button secondary"
                    disabled={(+filters.page + 1) * 30 >= count || loading}
                    onClick={() => field("page", String(+filters.page + 1))}
                  >
                    Próxima
                  </button>
                </div>
              )}
            </>
          )}

          {tab === "monitors" && (
            <>
              <div className="mining-panel">
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>
                  Acompanhamento de Concorrentes & Páginas
                </h3>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--muted, #64748b)", lineHeight: 1.5 }}>
                  O monitoramento registra alterações nos anúncios que você escolheu inspecionar. Para acompanhar novas ofertas de um concorrente, clique em <strong>“Monitorar anunciante”</strong> nos detalhes de uma oferta com Page ID.
                </p>
              </div>

              {!loading && !error && !monitors.length && (
                <div className="mining-empty-state">
                  <div className="mining-empty-icon">
                    <Activity size={28} />
                  </div>
                  <h3>Nenhum monitoramento ativo</h3>
                  <p>
                    Abra uma oferta salva e clique em “Monitorar oferta” ou “Monitorar anunciante” para registrar mudanças automáticas.
                  </p>
                </div>
              )}

              {monitors.map((m) => (
                <div className="mining-panel" key={m.id}>
                  <div className="mining-row">
                    <div>
                      <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 700 }}>
                        {m.label}
                      </h3>
                      <span style={{ fontSize: "12px", color: "var(--muted, #64748b)" }}>
                        {m.page_id ? `Página ID #${m.page_id}` : "Oferta selecionada"} ·{" "}
                        <span style={{ color: m.status === "active" ? "#10b981" : "#f59e0b", fontWeight: 700 }}>
                          {m.status === "active" ? "🟢 Ativo" : "⏸ Pausado"}
                        </span>
                      </span>
                    </div>

                    <div className="mining-actions">
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={() => void changeMonitor(m)}
                      >
                        {m.status === "active" ? "Pausar" : "Ativar"}
                      </button>
                      <button
                        className="button secondary"
                        style={{ color: "#ef4444" }}
                        disabled={busy}
                        onClick={() => void changeMonitor(m, true)}
                      >
                        Remover
                      </button>
                      {m.offer_id && (
                        <button
                          className="button"
                          onClick={async () => {
                            try {
                              const r = await api<{ offer: MinedOffer }>(
                                `offers/${m.offer_id}?workspace=${workspace}`,
                              );
                              setSelected(r.offer);
                            } catch (e) {
                              setError((e as Error).message);
                            }
                          }}
                        >
                          Ver oferta
                        </button>
                      )}
                    </div>
                  </div>

                  {m.last_error && (
                    <p role="alert" style={{ margin: 0, fontSize: "12px", color: "#ef4444" }}>
                      Último erro: {m.last_error}
                    </p>
                  )}

                  <MonitorHistory
                    key={`${m.id}-${revision}`}
                    monitor={m}
                    workspace={workspace}
                    open={async (id) => {
                      try {
                        const r = await api<{ offer: MinedOffer }>(
                          `offers/${id}?workspace=${workspace}`,
                        );
                        setSelected(r.offer);
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  />
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
