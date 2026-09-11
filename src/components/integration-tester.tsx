"use client";

import { useEffect, useRef, useState } from "react";
import { PlayCircle, Copy, Check, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { getIntegrationTestStatus, type IntegrationTestStatus } from "@/app/actions";
import type { Integration } from "@/lib/types";

const TRAFFIC_SOURCES = [
  { value: "meta", label: "Meta Ads (Facebook/Instagram)" },
  { value: "google", label: "Google Ads" },
  { value: "tiktok", label: "TikTok Ads" },
  { value: "organico", label: "Orgânico" },
  { value: "outro", label: "Outro" },
];

const PROVIDER_NAMES: Record<string, string> = {
  hotmart: "Hotmart",
  kiwify: "Kiwify",
  cakto: "Cakto",
  kirvano: "Kirvano",
  eduzz: "Eduzz",
  monetizze: "Monetizze",
  wiapy: "Wiapy",
  lowfy: "Lowfy",
  greenn: "Greenn",
  stripe: "Stripe",
};

function randomToken(): string {
  try {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  } catch {
    return Math.random().toString(36).slice(2, 14);
  }
}

function buildTestUrl(rawUrl: string, source: string, token: string): string | null {
  try {
    const input = /^https?:\/\//i.test(rawUrl.trim()) ? rawUrl.trim() : `https://${rawUrl.trim()}`;
    const url = new URL(input);
    url.searchParams.set("utm_source", source || "teste");
    url.searchParams.set("utm_medium", "teste_trackbase");
    url.searchParams.set("utm_campaign", "teste_integracao");
    url.searchParams.set("utm_content", `tbtest_${token}`);
    return url.toString();
  } catch {
    return null;
  }
}

export function IntegrationTester({
  workspace,
  integrations,
}: {
  workspace: string;
  integrations: Integration[];
}) {
  const [source, setSource] = useState("meta");
  const [platform, setPlatform] = useState("");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  // Um único token por sessão de teste: "Copiar" (pra rodar tráfego real, ex.
  // via WhatsApp/cloaker) e "Testar" (abre e monitora aqui mesmo) precisam
  // apontar pro MESMO link decorado, senão cada botão rastreia uma venda
  // diferente.
  const [token] = useState(randomToken);
  const [status, setStatus] = useState<IntegrationTestStatus | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const connectedProviders = Array.from(
    new Set(integrations.filter((i) => i.provider !== "meta" && i.provider !== "google").map((i) => i.provider)),
  );

  useEffect(() => {
    if (!platform && connectedProviders.length) setPlatform(connectedProviders[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedProviders.length]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const testUrl = link.trim() ? buildTestUrl(link, source, token) : null;

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    setPollError(null);
    setStatus({ pageview: false, checkout: false, sale: null });
    const tick = async () => {
      const result = await getIntegrationTestStatus(workspace, token);
      if ("error" in result) {
        setPollError(result.error);
        return;
      }
      setStatus(result);
      if (result.sale && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
    tick();
    pollRef.current = setInterval(tick, 4000);
  }

  function handleTestar() {
    if (!testUrl) return;
    window.open(testUrl, "_blank", "noopener,noreferrer");
    startPolling();
  }

  async function handleCopiar() {
    if (!testUrl) return;
    try {
      await navigator.clipboard.writeText(testUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard indisponível (permissão negada, contexto não seguro); sem-op.
    }
    // Copiar também já significa "vou rodar esse teste" -- por exemplo, colar
    // num link de anúncio real ou mandar pra alguém testar pelo celular.
    // Começa a monitorar mesmo sem abrir a aba aqui.
    if (!status) startPolling();
  }

  const StageRow = ({ done, label }: { done: boolean; label: string }) => (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
      {done ? (
        <CheckCircle2 size={16} color="#10B981" />
      ) : (
        <Loader2 size={16} className="spin" color="var(--muted, #94A3B8)" />
      )}
      <span style={{ color: done ? "var(--ink, #0F172A)" : "var(--muted, #64748B)" }}>{label}</span>
    </div>
  );

  return (
    <div
      style={{
        padding: "1.25rem",
        background: "var(--surface, #0F172A)",
        color: "#F8FAFC",
        borderRadius: "12px",
        border: "1px solid var(--line, #1E293B)",
        marginBottom: "1.5rem",
      }}
    >
      <h3 style={{ margin: "0 0 0.35rem", fontSize: "1.05rem" }}>Teste a integração</h3>
      <p style={{ margin: "0 0 1rem", fontSize: "0.82rem", color: "#94A3B8", lineHeight: 1.5 }}>
        É importante que o link testado seja o mesmo usado na sua campanha (se tiver cloaker, use o
        link do cloaker) — assim testamos exatamente o caminho real do seu tráfego.
        <br />
        <strong style={{ color: "#F8FAFC" }}>Como testar:</strong> clique em &quot;Testar&quot;, siga do
        início do funil até o checkout e gere um pagamento de verdade. Se estiver tudo certo, a venda
        aparece aqui embaixo com o criativo de teste marcado.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <label style={{ fontSize: "0.78rem", color: "#CBD5E1" }}>
          Fonte de Tráfego
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            style={{ width: "100%", marginTop: "0.3rem", padding: "0.55rem", borderRadius: "8px", background: "#1E293B", color: "#F8FAFC", border: "1px solid #334155" }}
          >
            {TRAFFIC_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: "0.78rem", color: "#CBD5E1" }}>
          Plataforma
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            style={{ width: "100%", marginTop: "0.3rem", padding: "0.55rem", borderRadius: "8px", background: "#1E293B", color: "#F8FAFC", border: "1px solid #334155" }}
          >
            {connectedProviders.length === 0 && <option value="">Nenhum gateway conectado</option>}
            {connectedProviders.map((p) => (
              <option key={p} value={p}>
                {PROVIDER_NAMES[p] || p}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label style={{ fontSize: "0.78rem", color: "#CBD5E1", display: "block", marginBottom: "0.75rem" }}>
        Link
        <input
          type="text"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="Cole o link aqui..."
          style={{ width: "100%", marginTop: "0.3rem", padding: "0.6rem 0.7rem", borderRadius: "8px", background: "#1E293B", color: "#F8FAFC", border: "1px solid #334155" }}
        />
      </label>

      <div style={{ display: "flex", gap: "0.6rem" }}>
        <button
          type="button"
          className="button"
          onClick={handleCopiar}
          disabled={!link.trim()}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copiado!" : "Copiar"}
        </button>
        <button
          type="button"
          className="button primary"
          onClick={handleTestar}
          disabled={!link.trim() || !platform}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
        >
          <PlayCircle size={15} /> Testar
        </button>
      </div>

      {status && (
        <div
          style={{
            marginTop: "1.1rem",
            padding: "0.9rem 1rem",
            background: "rgba(255,255,255,0.04)",
            borderRadius: "10px",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <StageRow done={status.pageview} label="Visita detectada na sua página" />
          <StageRow done={status.checkout} label="Clique no checkout detectado" />
          {!status.sale && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
              <Loader2 size={16} className="spin" color="var(--muted, #94A3B8)" />
              <span style={{ color: "#64748B" }}>
                Aguardando o pagamento ser confirmado pelo gateway (finalize a compra de teste)...
              </span>
            </div>
          )}
          {status.sale && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.85rem" }}>
              {status.sale.attributionMatched ? (
                <CheckCircle2 size={16} color="#10B981" style={{ flexShrink: 0, marginTop: 1 }} />
              ) : (
                <XCircle size={16} color="#EF4444" style={{ flexShrink: 0, marginTop: 1 }} />
              )}
              <span>
                Venda recebida da <strong>{PROVIDER_NAMES[status.sale.provider] || status.sale.provider}</strong> (status: {status.sale.status}).{" "}
                {status.sale.attributionMatched
                  ? "O criativo de teste chegou junto com a venda — atribuição confirmada de ponta a ponta."
                  : "A venda chegou, mas sem o marcador de teste — o gateway não devolveu o rastreamento (verifique se o rastreamento avançado/Sck está ativo na configuração da plataforma)."}
              </span>
            </div>
          )}
        </div>
      )}
      {pollError && (
        <p style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "#F87171" }}>{pollError}</p>
      )}
    </div>
  );
}
