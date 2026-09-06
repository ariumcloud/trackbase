"use client";

import { useState, useTransition } from "react";
import {
  Sparkles,
  Copy,
  Download,
  Trash2,
  Smartphone,
  Monitor,
  Layers,
  Code2,
  RefreshCw,
} from "lucide-react";
import type { FunnelRow, Offer } from "@/lib/types";
import {
  cloneFunnelAction,
  saveFunnelAction,
  duplicateFunnelAction,
  deleteFunnelAction,
} from "@/app/actions";
import {
  generateAutonomousHtml,
  type FunnelBlock,
  type ClonedFunnelStructure,
  type DetectedPixel,
} from "@/lib/funnel-cloner";

export function ClonadorView({
  workspace,
  funnels = [],
  offers = [],
  appUrl,
  run,
  pending,
}: {
  workspace: string;
  funnels: FunnelRow[];
  offers: Offer[];
  appUrl: string;
  run: (fn: () => Promise<unknown>) => void;
  pending: boolean;
}) {
  const [urlInput, setUrlInput] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState("");
  const [activeFunnel, setActiveFunnel] = useState<{
    id?: string;
    name: string;
    offer_id?: string;
    source_url: string;
    blocks: FunnelBlock[];
    pixels: DetectedPixel[];
    version: number;
    status: "draft" | "published" | "archived";
  } | null>(null);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, startSaving] = useTransition();

  const handleStartClone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    if (!authorized) {
      setCloneError("Você precisa confirmar que tem autorização para reproduzir esta página.");
      return;
    }
    setCloneError("");
    setCloning(true);

    try {
      const res = await cloneFunnelAction(workspace, urlInput.trim());
      if (!res.ok || !res.structure) {
        setCloneError(res.error || "Não foi possível extrair a estrutura da página.");
        setCloning(false);
        return;
      }

      const struct = res.structure as ClonedFunnelStructure;
      setActiveFunnel({
        name: struct.title || "Funil Clonado",
        source_url: struct.sourceUrl,
        blocks: struct.blocks || [],
        pixels: struct.pixels || [],
        version: 1,
        status: "draft",
      });
      setUrlInput("");
    } catch {
      setCloneError("Falha na requisição ao clonador.");
    } finally {
      setCloning(false);
    }
  };

  const updateBlock = (blockId: string, patch: Partial<FunnelBlock>) => {
    if (!activeFunnel) return;
    setActiveFunnel({
      ...activeFunnel,
      blocks: activeFunnel.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)),
    });
  };

  const handleSave = () => {
    if (!activeFunnel) return;
    startSaving(async () => {
      const res = await saveFunnelAction(workspace, {
        id: activeFunnel.id,
        offer_id: activeFunnel.offer_id,
        name: activeFunnel.name,
        source_url: activeFunnel.source_url,
        blocks: activeFunnel.blocks,
        pixels: activeFunnel.pixels,
        status: activeFunnel.status,
      });
      if (res.ok) {
        if (res.id) setActiveFunnel((prev) => (prev ? { ...prev, id: res.id } : null));
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    });
  };

  const handleExportJson = () => {
    if (!activeFunnel) return;
    const blob = new Blob([JSON.stringify(activeFunnel, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeFunnel.name.toLowerCase().replace(/\s+/g, "_")}_funnel.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportHtml = () => {
    if (!activeFunnel) return;
    const selectedOffer = offers.find((o) => o.id === activeFunnel.offer_id);
    const html = generateAutonomousHtml(
      {
        sourceUrl: activeFunnel.source_url,
        title: activeFunnel.name,
        blocks: activeFunnel.blocks,
        pixels: activeFunnel.pixels,
        detectedCheckouts: [],
        extractedAt: new Date().toISOString(),
      },
      appUrl,
      selectedOffer?.public_key,
    );

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeFunnel.name.toLowerCase().replace(/\s+/g, "_")}_landing.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      {/* 1. Barra de Ação / Inserir URL */}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Clonador e Minerador de Funil</h2>
            <p>
              Capture a estrutura visual de páginas autorizadas, edite textos, CTAs e injete o rastreador
              Trackbase automaticamente.
            </p>
          </div>
          <span className="chip">{funnels.length} páginas no workspace</span>
        </div>

        <form onSubmit={handleStartClone} style={{ marginTop: "1rem" }}>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <input
              type="url"
              required
              placeholder="https://suaoferta.com/vsl ou página de vendas"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              style={{ flex: 1, minWidth: "260px" }}
              disabled={cloning}
            />
            <button className="button primary" disabled={cloning} type="submit">
              {cloning ? (
                <>
                  <RefreshCw size={15} className="spin" /> Analisando elementos...
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Analisar e Clonar Página
                </>
              )}
            </button>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginTop: "0.75rem",
              fontSize: "0.85rem",
              color: "var(--muted, #64748B)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={authorized}
              onChange={(e) => setAuthorized(e.target.checked)}
              style={{ width: "auto" }}
            />
            Declaro ter autorização do proprietário para clonar ou reproduzir esta estrutura de página.
          </label>

          {cloneError && (
            <p className="form-message" style={{ color: "var(--red, #EF3340)", marginTop: "0.5rem" }}>
              {cloneError}
            </p>
          )}
        </form>
      </section>

      {/* 2. Editor & Preview se houver funil ativo */}
      {activeFunnel && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
          {/* Coluna Esquerda: Editor de Blocos */}
          <section className="panel" style={{ height: "fit-content" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div>
                <h3>Editando: {activeFunnel.name}</h3>
                <small style={{ color: "var(--muted, #64748B)" }}>
                  Origem: {activeFunnel.source_url} · v{activeFunnel.version}
                </small>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  className="button small ghost"
                  onClick={() => setActiveFunnel(null)}
                >
                  Fechar
                </button>
                <button
                  className="button small primary"
                  disabled={isSaving}
                  onClick={handleSave}
                >
                  {isSaving ? "Salvando..." : savedSuccess ? "Salvo!" : "Salvar Funil"}
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gap: "0.75rem", marginBottom: "1rem" }}>
              <label>
                Nome da Landing no Workspace
                <input
                  value={activeFunnel.name}
                  onChange={(e) => setActiveFunnel({ ...activeFunnel, name: e.target.value })}
                />
              </label>
              <label>
                Vincular à Oferta (Injeção de UTMs e Tracker)
                <select
                  value={activeFunnel.offer_id || ""}
                  onChange={(e) => setActiveFunnel({ ...activeFunnel, offer_id: e.target.value || undefined })}
                >
                  <option value="">Nenhuma oferta vinculada</option>
                  {offers.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.currency})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Pixels detectados */}
            {activeFunnel.pixels.length > 0 && (
              <div
                style={{
                  padding: "0.75rem",
                  background: "var(--surface-subtle, #F8FAFC)",
                  borderRadius: "8px",
                  border: "1px solid var(--line, #E2E8F0)",
                  marginBottom: "1rem",
                }}
              >
                <small style={{ fontWeight: 600, color: "var(--brand-accent, #5B34EA)" }}>
                  Pixels detectados na página de origem:
                </small>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.35rem" }}>
                  {activeFunnel.pixels.map((p, idx) => (
                    <span key={idx} className="chip" style={{ fontSize: "0.75rem" }}>
                      {p.type.toUpperCase()}: {p.id}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Lista de Blocos Editáveis */}
            <div style={{ display: "grid", gap: "1rem" }}>
              <span className="tag">BLOCOS EXTRAÍDOS</span>
              {activeFunnel.blocks.map((block, idx) => (
                <div
                  key={block.id || idx}
                  style={{
                    padding: "1rem",
                    border: "1px solid var(--line, #E2E8F0)",
                    borderRadius: "8px",
                    background: "#FFFFFF",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <strong style={{ fontSize: "0.85rem", textTransform: "uppercase", color: "var(--brand-accent, #5B34EA)" }}>
                      Bloco {idx + 1}: {block.type}
                    </strong>
                  </div>

                  <label style={{ fontSize: "0.8rem" }}>
                    Título / Headline
                    <input
                      value={block.title || ""}
                      onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                    />
                  </label>

                  {block.subtitle !== undefined && (
                    <label style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}>
                      Subtítulo / Texto
                      <textarea
                        rows={2}
                        value={block.subtitle || ""}
                        onChange={(e) => updateBlock(block.id, { subtitle: e.target.value })}
                      />
                    </label>
                  )}

                  {block.ctaText !== undefined && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "0.5rem" }}>
                      <label style={{ fontSize: "0.8rem" }}>
                        Texto do Botão (CTA)
                        <input
                          value={block.ctaText || ""}
                          onChange={(e) => updateBlock(block.id, { ctaText: e.target.value })}
                        />
                      </label>
                      <label style={{ fontSize: "0.8rem" }}>
                        Link de Destino / Checkout
                        <input
                          value={block.ctaUrl || ""}
                          onChange={(e) => updateBlock(block.id, { ctaUrl: e.target.value })}
                        />
                      </label>
                    </div>
                  )}

                  {block.videoUrl !== undefined && (
                    <label style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}>
                      URL do Vídeo / Iframe (VSL)
                      <input
                        value={block.videoUrl || ""}
                        onChange={(e) => updateBlock(block.id, { videoUrl: e.target.value })}
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>

            {/* Ações de Exportação */}
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
              <button className="button ghost" onClick={handleExportJson}>
                <Code2 size={15} /> Exportar JSON
              </button>
              <button className="button primary" onClick={handleExportHtml}>
                <Download size={15} /> Baixar HTML/CSS Pronto
              </button>
            </div>
          </section>

          {/* Coluna Direita: Preview Desktop / Mobile */}
          <section className="panel" style={{ height: "fit-content" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3>Prévia em Tempo Real</h3>
              <div style={{ display: "flex", gap: "0.25rem", background: "var(--surface-subtle, #F1F5F9)", padding: "0.25rem", borderRadius: "6px" }}>
                <button
                  className={`button small ${previewMode === "desktop" ? "primary" : "ghost"}`}
                  onClick={() => setPreviewMode("desktop")}
                >
                  <Monitor size={14} /> Desktop
                </button>
                <button
                  className={`button small ${previewMode === "mobile" ? "primary" : "ghost"}`}
                  onClick={() => setPreviewMode("mobile")}
                >
                  <Smartphone size={14} /> Mobile
                </button>
              </div>
            </div>

            <div
              style={{
                width: "100%",
                maxWidth: previewMode === "mobile" ? "375px" : "100%",
                margin: "0 auto",
                background: "#FAFAFB",
                borderRadius: "12px",
                border: "1px solid var(--line, #E2E8F0)",
                overflow: "hidden",
                boxShadow: "0 10px 25px rgba(0,0,0,0.05)",
                transition: "max-width 0.3s ease",
              }}
            >
              {activeFunnel.blocks.map((b, i) => (
                <div
                  key={i}
                  style={{
                    padding: previewMode === "mobile" ? "1.5rem 1rem" : "2.5rem 1.5rem",
                    textAlign: "center",
                    borderBottom: "1px solid #E2E8F0",
                    background: b.style?.bg || "#FFFFFF",
                    color: b.style?.textColor || "#17152F",
                  }}
                >
                  {b.badge && (
                    <span
                      style={{
                        display: "inline-block",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        background: "#EEF2FF",
                        color: "#4F46E5",
                        padding: "0.25rem 0.6rem",
                        borderRadius: "9999px",
                        marginBottom: "0.5rem",
                      }}
                    >
                      {b.badge}
                    </span>
                  )}
                  <h2 style={{ fontSize: previewMode === "mobile" ? "1.25rem" : "1.75rem", lineHeight: 1.25, marginBottom: "0.5rem" }}>
                    {b.title}
                  </h2>
                  {b.subtitle && (
                    <p style={{ fontSize: "0.9rem", color: "#64748B", marginBottom: "1rem" }}>
                      {b.subtitle}
                    </p>
                  )}
                  {b.ctaText && (
                    <span
                      style={{
                        display: "inline-block",
                        background: b.style?.accentColor || "#5B34EA",
                        color: "#FFFFFF",
                        padding: "0.75rem 1.5rem",
                        borderRadius: "6px",
                        fontWeight: 700,
                        fontSize: "0.9rem",
                        boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
                      }}
                    >
                      {b.ctaText}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* 3. Lista de Funis Salvos no Workspace */}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Páginas e Funis no Workspace</h2>
            <p>Páginas extraídas e versionadas para as suas ofertas</p>
          </div>
        </div>

        {funnels.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
            {funnels.map((f) => (
              <div
                key={f.id}
                style={{
                  padding: "1.25rem",
                  borderRadius: "10px",
                  border: "1px solid var(--line, #E2E8F0)",
                  background: "var(--surface, #FFFFFF)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="chip" style={{ fontSize: "0.75rem" }}>
                      v{f.version} · {f.blocks?.length || 0} blocos
                    </span>
                    <span
                      className="chip"
                      style={{
                        fontSize: "0.75rem",
                        background: f.status === "published" ? "#ECFDF5" : "#F3F4F6",
                        color: f.status === "published" ? "#065F46" : "#4B5563",
                      }}
                    >
                      {f.status === "published" ? "Publicado" : "Rascunho"}
                    </span>
                  </div>
                  <h3 style={{ marginTop: "0.5rem", fontSize: "1.1rem" }}>{f.name}</h3>
                  {f.source_url && (
                    <small style={{ color: "var(--muted, #64748B)", wordBreak: "break-all" }}>
                      {f.source_url}
                    </small>
                  )}
                </div>

                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                  <button
                    className="button small primary"
                    onClick={() =>
                      setActiveFunnel({
                        id: f.id,
                        name: f.name,
                        offer_id: f.offer_id || undefined,
                        source_url: f.source_url || "",
                        blocks: (f.blocks || []) as FunnelBlock[],
                        pixels: (f.pixels || []) as DetectedPixel[],
                        version: f.version || 1,
                        status: f.status || "draft",
                      })
                    }
                  >
                    Editar Blocos
                  </button>
                  <button
                    className="button small ghost"
                    disabled={pending}
                    onClick={() => run(() => duplicateFunnelAction(workspace, f.id))}
                  >
                    <Copy size={13} /> Duplicar
                  </button>
                  <button
                    className="button small ghost"
                    style={{ color: "var(--red, #EF3340)" }}
                    disabled={pending}
                    onClick={() => {
                      if (confirm(`Deseja excluir o funil "${f.name}"?`)) {
                        run(() => deleteFunnelAction(workspace, f.id));
                      }
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--muted, #64748B)" }}>
            <Layers size={36} style={{ margin: "0 auto 0.75rem", opacity: 0.5 }} />
            <h3>Nenhum funil cadastrado</h3>
            <p>Insira a URL de uma página autorizada no campo acima para começar.</p>
          </div>
        )}
      </section>
    </div>
  );
}
