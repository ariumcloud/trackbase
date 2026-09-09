"use client";
/* Remote captured media must load directly, never through the server image optimizer. */
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState } from "react";
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
function External({
  url,
  children,
}: {
  url: string | null;
  children: React.ReactNode;
}) {
  return url && publicUrl(url) ? (
    <a
      className="button secondary"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ) : null;
}
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
  return (
    <section className="mining-panel" aria-label="Detalhes da oferta">
      <div className="mining-row">
        <h2>{offer.advertiser}</h2>
        <button className="button secondary" onClick={close}>
          Fechar detalhes
        </button>
      </div>
      <p>
        {offer.capture.page_name || "Página não identificada"} · Biblioteca #
        {offer.library_id}
      </p>
      <div className="mining-actions">
        <External url={offer.library_url}>Anúncio original</External>
        <External url={offer.capture.landing_url}>Página de destino</External>
      </div>
      <p>
        Formato: {formats[offer.capture.format]} · Plataformas:{" "}
        {offer.capture.platforms.join(", ") || "Não identificadas"}
      </p>
      <p>
        Início: {offer.capture.start_date || "Não identificado"} ·{" "}
        {offer.days_active ?? "?"} dias ativos na última captura ·{" "}
        {offer.capture.activity === "active"
          ? "Ativo"
          : offer.capture.activity === "inactive"
            ? "Inativo"
            : "Atividade desconhecida"}
      </p>
      <p>
        Salvo: {date(offer.created_at)} · Última captura:{" "}
        {date(offer.captured_at)} · Anúncios relacionados:{" "}
        {offer.capture.related_count ?? "Não identificado"}
      </p>
      <h3>{offer.capture.headline || "Headline não identificada"}</h3>
      <p className="mining-copy">
        {offer.capture.copy || "Sem copy capturada."}
      </p>
      {!offer.capture.media.length && (
        <p>Sem mídia disponível nesta captura.</p>
      )}
      <div className="mining-media">
        {offer.capture.media.map(
          (m, i) =>
            publicUrl(m.url) && (
              <div key={i}>
                {m.type === "video" ? (
                  <video controls preload="none" src={m.url} />
                ) : (
                  <img
                    src={m.url}
                    alt={`Criativo ${i + 1}`}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                )}
                <External url={m.url}>Abrir criativo</External>
              </div>
            ),
        )}
      </div>
      <small>
        As URLs de mídia são temporárias e podem expirar. Nenhum arquivo de
        mídia é armazenado.
      </small>
      <div className="mining-fields">
        <label>
          Nicho
          <input
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            maxLength={200}
          />
        </label>
        <label>
          Tags (separadas por vírgula)
          <input value={tags} onChange={(e) => setTags(e.target.value)} />
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="saved">Salva</option>
            <option value="reviewed">Analisada</option>
            <option value="archived">Arquivada</option>
          </select>
        </label>
      </div>
      <label>
        Observações internas
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={8000}
          rows={4}
        />
      </label>
      <div className="mining-actions">
        <button
          className="button"
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
          Salvar alterações
        </button>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() =>
            void run(() =>
              api(`monitors?${query}`, "POST", {
                offer_id: offer.id,
                label: offer.advertiser,
              }),
            )
          }
        >
          Monitorar oferta
        </button>
        <button
          className="button secondary"
          disabled={busy || !offer.capture.page_id}
          title={
            !offer.capture.page_id ? "Page ID não disponível na captura" : ""
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
          Monitorar anunciante
        </button>
        <button
          className="button secondary"
          disabled={busy}
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
          {analyzing ? "Análise em andamento…" : "Analisar novamente com IA"}
        </button>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() =>
            void run(() =>
              api(`${path}?${query}`, "PATCH", { status: "archived" }),
            )
          }
        >
          Arquivar
        </button>
        <button
          className="button danger"
          disabled={busy}
          onClick={() => {
            if (
              window.confirm(
                "Excluir esta oferta e seu histórico? Esta ação não pode ser desfeita.",
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
          Excluir oferta
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <h3>Análise de IA</h3>
      {!history && <p>Carregando histórico…</p>}
      {history && !history.analyses.length && (
        <p>Nenhuma análise solicitada.</p>
      )}
      {history?.analyses.map((a) => (
        <article key={a.id}>
          <p>
            {date(a.created_at)} ·{" "}
            {a.status === "running"
              ? "Análise em andamento"
              : a.status === "failed"
                ? a.error
                : "Concluída"}
          </p>
          {a.result && <AnalysisView analysis={a.result} />}
        </article>
      ))}
      <h3>Histórico de alterações</h3>
      {history && !history.changes.length && <p>Nenhuma mudança detectada.</p>}
      {history?.changes.map((c) => (
        <details key={c.id}>
          <summary>
            {date(c.created_at)} · {c.differences.length} alterações
          </summary>
          {c.differences.map((d) => (
            <div key={d.field}>
              <strong>{d.field}</strong>
              <div className="mining-compare">
                <pre>Anterior: {JSON.stringify(d.before, null, 2)}</pre>
                <pre>Atual: {JSON.stringify(d.after, null, 2)}</pre>
              </div>
            </div>
          ))}
        </details>
      ))}
      <h3>Snapshots</h3>
      {history?.snapshots.map((s) => (
        <details key={s.id}>
          <summary>{date(s.captured_at)}</summary>
          <pre>{JSON.stringify(s.capture, null, 2)}</pre>
        </details>
      ))}
      <h3>Verificações</h3>
      {history?.runs.map((r) => (
        <p key={r.id}>
          {date(r.created_at)} ·{" "}
          {r.status === "observed"
            ? "Observado pela extensão"
            : r.error || "Falha"}
        </p>
      ))}
      <div className="mining-actions">
        <button
          className="button secondary"
          disabled={historyPage === 0}
          onClick={() => setHistoryPage((p) => p - 1)}
        >
          Histórico anterior
        </button>
        <button
          className="button secondary"
          disabled={!history || (historyPage + 1) * 30 >= history.count}
          onClick={() => setHistoryPage((p) => p + 1)}
        >
          Mais histórico
        </button>
      </div>
    </section>
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
    summary: "Resumo",
    angle: "Ângulo",
    hook: "Gancho",
    promise: "Promessa",
    mechanism: "Mecanismo",
    audience: "Público provável",
    awareness: "Consciência",
    proof: "Prova",
    cta: "CTA",
    copy_structure: "Estrutura da copy",
    strengths: "Pontos fortes",
    weaknesses: "Pontos fracos",
    longevity_hypotheses: "Hipóteses de longevidade",
    variations: "Variações",
    suggested_tags: "Tags sugeridas",
    confidence: "Confiança",
  };
  return (
    <dl>
      {Object.entries(analysis).map(([key, value]) => (
        <div key={key}>
          <dt>
            <strong>{labels[key]}</strong>
          </dt>
          <dd>
            {(Array.isArray(value) ? value : [value]).map((v, i) => (
              <p key={i}>
                {typeof v === "object"
                  ? `${v.text} (${v.basis === "hypothesis" ? "Hipótese" : v.basis === "observed" ? "Observado" : "Indisponível"})`
                  : String(v)}
              </p>
            ))}
          </dd>
        </div>
      ))}
    </dl>
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
  return (
    <div className="mining">
      <nav className="mining-actions" aria-label="Mineração">
        <button
          className={`button ${tab === "offers" ? "" : "secondary"}`}
          onClick={() => setTab("offers")}
        >
          Ofertas salvas
        </button>
        <button
          className={`button ${tab === "monitors" ? "" : "secondary"}`}
          onClick={() => setTab("monitors")}
        >
          Monitoramento
        </button>
        <button
          className={`button ${tab === "extension" ? "" : "secondary"}`}
          onClick={() => setTab("extension")}
        >
          Configurar extensão
        </button>
      </nav>
      {error && (
        <div role="alert">
          {error}{" "}
          <button className="button secondary" onClick={refresh}>
            Tentar novamente
          </button>
        </div>
      )}
      {tab === "extension" ? (
        <ExtensionSettings key={workspace} workspace={workspace} />
      ) : (
        <>
          {loading && <p role="status">Carregando…</p>}
          {tab === "offers" && (
            <>
              <div className="mining-fields">
                <label>
                  Buscar
                  <input
                    value={filters.q}
                    onChange={(e) => field("q", e.target.value)}
                    placeholder="Anunciante, copy, nicho ou URL"
                  />
                </label>
                <label>
                  Formato
                  <select
                    value={filters.format}
                    onChange={(e) => field("format", e.target.value)}
                  >
                    <option value="">Todos</option>
                    {Object.entries(formats).map(([k, v]) => (
                      <option value={k} key={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Status
                  <select
                    value={filters.status}
                    onChange={(e) => field("status", e.target.value)}
                  >
                    <option value="">Todos</option>
                    <option value="saved">Salva</option>
                    <option value="reviewed">Analisada</option>
                    <option value="archived">Arquivada</option>
                  </select>
                </label>
                <label>
                  Tag
                  <input
                    value={filters.tag}
                    onChange={(e) => field("tag", e.target.value)}
                  />
                </label>
                <label>
                  Mínimo de dias ativos
                  <input
                    type="number"
                    min="0"
                    value={filters.min_days}
                    onChange={(e) => field("min_days", e.target.value)}
                  />
                </label>
                <label>
                  Máximo de dias ativos
                  <input
                    type="number"
                    min="0"
                    value={filters.max_days}
                    onChange={(e) => field("max_days", e.target.value)}
                  />
                </label>
                <label>
                  Ordenar
                  <select
                    value={filters.sort}
                    onChange={(e) => field("sort", e.target.value)}
                  >
                    <option value="saved">Data salva</option>
                    <option value="days">Dias ativos</option>
                    <option value="advertiser">Anunciante</option>
                  </select>
                </label>
              </div>
              {!loading && !error && !offers.length && (
                <section className="mining-panel">
                  <h2>Nenhuma oferta encontrada</h2>
                  <p>
                    Salve anúncios pela extensão na Biblioteca da Meta ou ajuste
                    os filtros.
                  </p>
                  <button
                    className="button"
                    onClick={() => setTab("extension")}
                  >
                    Vincular extensão
                  </button>
                </section>
              )}
              <div className="mining-grid">
                {offers.map((o) => (
                  <article className="mining-panel" key={o.id}>
                    <h3>{o.advertiser}</h3>
                    <p>
                      {o.niche || "Sem nicho"} · {formats[o.capture.format]} ·{" "}
                      {o.days_active ?? "?"} dias
                    </p>
                    <p className="mining-excerpt">
                      {o.capture.headline ||
                        o.capture.copy ||
                        "Sem texto capturado"}
                    </p>
                    <p>
                      {o.tags.join(" · ")} ·{" "}
                      {o.status === "archived"
                        ? "Arquivada"
                        : o.status === "reviewed"
                          ? "Analisada"
                          : "Salva"}
                    </p>
                    <small>Salva em {date(o.created_at)}</small>
                    <div className="mining-actions">
                      <button className="button" onClick={() => setSelected(o)}>
                        Ver oferta
                      </button>
                      <External url={o.library_url}>Original</External>
                    </div>
                  </article>
                ))}
              </div>
              <div className="mining-actions">
                <button
                  className="button secondary"
                  disabled={+filters.page === 0 || loading}
                  onClick={() => field("page", String(+filters.page - 1))}
                >
                  Anterior
                </button>
                <span>{count} ofertas</span>
                <button
                  className="button secondary"
                  disabled={(+filters.page + 1) * 30 >= count || loading}
                  onClick={() => field("page", String(+filters.page + 1))}
                >
                  Próxima
                </button>
              </div>
            </>
          )}
          {tab === "monitors" && (
            <>
              <section className="mining-panel">
                <p>
                  O acompanhamento registra os anúncios que você escolhe e
                  observa pela extensão. Verificações automáticas não estão
                  disponíveis. Ausência de um card não prova que o anúncio ficou
                  inativo.
                </p>
                <p>
                  Para acompanhar novos anúncios de uma página, use “Monitorar
                  anunciante” nos detalhes de uma oferta com Page ID e, na
                  Biblioteca, clique em “Registrar verificação” nos cards
                  visíveis.
                </p>
              </section>
              {!loading && !error && !monitors.length && (
                <p>
                  Nenhum monitoramento. Escolha uma oferta salva para começar.
                </p>
              )}
              {monitors.map((m) => (
                <section className="mining-panel" key={m.id}>
                  <h3>{m.label}</h3>
                  <p>
                    {m.page_id ? `Página ${m.page_id}` : "Oferta escolhida"} ·{" "}
                    {m.status === "paused"
                      ? "Monitoramento pausado"
                      : "Ativo — aguardando captura"}
                  </p>
                  <p>
                    Última verificação: {date(m.last_checked_at)} · Próxima:{" "}
                    {m.next_check_at
                      ? date(m.next_check_at)
                      : "Sem agendamento automático"}
                  </p>
                  {m.last_error && <p role="alert">Falha: {m.last_error}</p>}
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
                      disabled={busy}
                      onClick={() => void changeMonitor(m, true)}
                    >
                      Remover monitoramento
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
                        Ver histórico
                      </button>
                    )}
                  </div>
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
                </section>
              ))}
            </>
          )}
        </>
      )}
      {selected && (
        <OfferDetails
          key={selected.id}
          offer={selected}
          close={() => setSelected(null)}
          changed={refresh}
        />
      )}
    </div>
  );
}
