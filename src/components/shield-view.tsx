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
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Zap,
  Server,
  MousePointerClick,
  AlertTriangle,
  CheckCircle2,
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
  const [showTutorial, setShowTutorial] = useState(true);

  // Estados do Modal de Guia DNS (CNAME)
  const [showDnsModal, setShowDnsModal] = useState(false);
  const [dnsPlatformTab, setDnsPlatformTab] = useState<
    "cloudflare" | "hostinger" | "registrobr" | "godaddy"
  >("cloudflare");
  const [copiedDnsKey, setCopiedDnsKey] = useState<string | null>(null);

  // Estados das regras de segurança e filtragem (interativas)
  const [blockDc, setBlockDc] = useState(true);
  const [requireClickId, setRequireClickId] = useState(true);
  const [blockUa, setBlockUa] = useState(true);

  // Estatísticas agregadas dos logs
  const totalLogs = logs.length;
  const blackCount = logs.filter((l) => l.verdict === "black").length;
  const grayCount = logs.filter((l) => l.verdict === "gray").length;
  const whiteCount = logs.filter((l) => l.verdict === "white").length;

  const blackPercent = totalLogs ? Math.round((blackCount / totalLogs) * 100) : 0;
  const grayPercent = totalLogs ? Math.round((grayCount / totalLogs) * 100) : 0;
  const whitePercent = totalLogs ? Math.round((whiteCount / totalLogs) * 100) : 0;

  function copyDnsValue(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopiedDnsKey(key);
    setTimeout(() => setCopiedDnsKey(null), 2000);
  }

  function getShieldPublicUrl(s: ShieldRow) {
    if (s.custom_domain && s.custom_domain.trim()) {
      return `https://${s.custom_domain.trim()}`;
    }
    return `${appUrl}/s/${s.slug}`;
  }

  function copyToClipboard(s: ShieldRow) {
    const fullUrl = getShieldPublicUrl(s);
    navigator.clipboard.writeText(fullUrl);
    setCopiedSlug(s.id);
    setTimeout(() => setCopiedSlug(null), 2500);
  }

  function handleOpenCreate() {
    setEditingShield(null);
    setBlockDc(true);
    setRequireClickId(true);
    setBlockUa(true);
    setErrorMsg(null);
    setShowModal(true);
  }

  function handleOpenEdit(s: ShieldRow) {
    setEditingShield(s);
    setBlockDc(s.block_datacenters);
    setRequireClickId(s.require_click_id);
    setBlockUa(s.block_unknown_user_agents);
    setErrorMsg(null);
    setShowModal(true);
  }

  function handleToggle(s: ShieldRow) {
    startTransition(async () => {
      await toggleShield(workspaceId, s.id, !s.active);
    });
  }

  function handleDelete(id: string) {
    if (
      !confirm(
        "Tem certeza que deseja excluir esta blindagem? O link deixará de responder imediatamente.",
      )
    ) {
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
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Top Banner de Apresentação com Alto Contraste */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "16px",
          padding: "1.75rem",
          boxShadow: "var(--shadow-sm)",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div style={{ maxWidth: "720px" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "4px 10px",
                borderRadius: "9999px",
                background: "var(--green-soft, #ECFDF5)",
                border: "1px solid var(--green-border, #A7F3D0)",
                color: "var(--green-text, #047857)",
                fontSize: "0.75rem",
                fontWeight: 700,
                marginBottom: "0.75rem",
              }}
            >
              <ShieldCheck size={14} color="var(--green, #10B981)" />
              TRACKBASE SHIELD • PROTEÇÃO DE OFERTA &amp; ANTI-CLONAGEM
            </div>
            <h2
              style={{
                fontSize: "1.5rem",
                fontWeight: 800,
                color: "var(--ink)",
                letterSpacing: "-0.5px",
                marginBottom: "0.5rem",
              }}
            >
              Proteja sua oferta de ser copiada por espiões e bloqueada
            </h2>
            <p
              style={{
                fontSize: "0.95rem",
                color: "var(--ink-secondary)",
                lineHeight: "1.5",
              }}
            >
              Carregamento instantâneo com tripla blindagem inteligente:
              revisores do Facebook/Google veem a{" "}
              <strong style={{ color: "#2563EB" }}>Página Segura (White)</strong> para aprovar seus
              anúncios sem risco de bloqueio; ferramentas espiãs (AdHeart, robôs) caem na{" "}
              <strong style={{ color: "#D97706" }}>Página Isca (Gray)</strong> para clonarem o
              conteúdo errado; e compradores reais entram direto na sua{" "}
              <strong style={{ color: "var(--green, #10B981)" }}>Oferta Real de Alta Conversão (Black)</strong>.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
            <button
              type="button"
              onClick={() => setShowDnsModal(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                padding: "0.6rem 1rem",
                borderRadius: "10px",
                background: "var(--brand-soft, #F3F0FF)",
                border: "1px solid var(--brand-border, #DDD6FE)",
                color: "var(--brand-accent, #5B34EA)",
                fontSize: "0.85rem",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <Globe size={15} />
              Como Apontar CNAME?
            </button>

            <button
              type="button"
              onClick={() => setShowTutorial(!showTutorial)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.6rem 1rem",
                borderRadius: "10px",
                background: "var(--surface-muted)",
                border: "1px solid var(--line)",
                color: "var(--ink)",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <HelpCircle size={15} color="var(--brand-accent)" />
              {showTutorial ? "Ocultar Passo a Passo" : "Como Funciona?"}
              {showTutorial ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>

            <button
              type="button"
              onClick={handleOpenCreate}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.65rem 1.25rem",
                borderRadius: "10px",
                background: "var(--brand-accent, #5B34EA)",
                color: "#FFFFFF",
                fontSize: "0.9rem",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(91, 52, 234, 0.35)",
              }}
            >
              <Plus size={16} />
              Criar Nova Blindagem
            </button>
          </div>
        </div>

        {/* Passo a Passo Explicativo (Fácil de entender) */}
        {showTutorial && (
          <div
            style={{
              background: "var(--surface-subtle, #F9FAFB)",
              border: "1px solid var(--line)",
              borderRadius: "12px",
              padding: "1.25rem",
              marginTop: "0.5rem",
            }}
          >
            <div
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: "var(--ink)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "0.85rem",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <Zap size={15} color="var(--brand-accent)" />
              Passo a Passo: Como você configura e protege sua campanha
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "1rem",
              }}
            >
              <div
                style={{
                  background: "var(--surface)",
                  padding: "1rem",
                  borderRadius: "10px",
                  border: "1px solid var(--line)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    color: "var(--ink)",
                    marginBottom: "0.4rem",
                  }}
                >
                  <span
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "50%",
                      background: "var(--brand-soft)",
                      color: "var(--brand-accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.75rem",
                      fontWeight: 800,
                    }}
                  >
                    1
                  </span>
                  Domínio Próprio ou Link Seguro
                </div>
                <p style={{ fontSize: "0.82rem", color: "var(--muted)", lineHeight: "1.4", marginBottom: "0.5rem" }}>
                  Você pode usar o link padrão do Trackbase ou apontar um <strong>CNAME</strong> no
                  seu domínio (ex: <code>oferta.seusite.com</code>) apontando para o Trackbase.
                  Assim seus anúncios rodam no seu próprio domínio com 100% de autoridade.
                </p>
                <button
                  type="button"
                  onClick={() => setShowDnsModal(true)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    color: "var(--brand-accent)",
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  <Globe size={13} />
                  Ver tutorial passo a passo de como apontar CNAME →
                </button>
              </div>

              <div
                style={{
                  background: "var(--surface)",
                  padding: "1rem",
                  borderRadius: "10px",
                  border: "1px solid var(--line)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    color: "var(--ink)",
                    marginBottom: "0.4rem",
                  }}
                >
                  <span
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "50%",
                      background: "var(--brand-soft)",
                      color: "var(--brand-accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.75rem",
                      fontWeight: 800,
                    }}
                  >
                    2
                  </span>
                  Configure as 3 Páginas
                </div>
                <p style={{ fontSize: "0.82rem", color: "var(--muted)", lineHeight: "1.4" }}>
                  Informe a <strong>White</strong> (artigo neutro para os robôs do Facebook/Google
                  aprovarem seu anúncio), a <strong>Gray</strong> (oferta isca para os espiões do
                  AdHeart clonarem errado) e a <strong>Black</strong> (sua VSL real de alta
                  conversão).
                </p>
              </div>

              <div
                style={{
                  background: "var(--surface)",
                  padding: "1rem",
                  borderRadius: "10px",
                  border: "1px solid var(--line)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    color: "var(--ink)",
                    marginBottom: "0.4rem",
                  }}
                >
                  <span
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "50%",
                      background: "var(--brand-soft)",
                      color: "var(--brand-accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.75rem",
                      fontWeight: 800,
                    }}
                  >
                    3
                  </span>
                  Cole a URL no seu Anúncio
                </div>
                <p style={{ fontSize: "0.82rem", color: "var(--muted)", lineHeight: "1.4" }}>
                  Cole o link blindado no Meta Ads ou TikTok. A página abre instantaneamente sem
                  redirecionamento (zero tela branca) e o Trackbase já mede a atenção do lead (rolagem
                  25/50/75/90%) e envia as compras direto para o Facebook Ads automaticamente!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Estatísticas Agregadas */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1rem",
            paddingTop: "0.5rem",
          }}
        >
          <div
            style={{
              background: "var(--surface-muted)",
              border: "1px solid var(--line)",
              borderRadius: "12px",
              padding: "1rem 1.25rem",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                background: "var(--green-soft, #ECFDF5)",
                border: "1px solid var(--green-border, #A7F3D0)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--green, #10B981)",
                flexShrink: 0,
              }}
            >
              <UserCheck size={20} />
            </div>
            <div>
              <div style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600 }}>
                Leads Reais (Black Page)
              </div>
              <div
                style={{
                  fontSize: "1.35rem",
                  fontWeight: 800,
                  color: "var(--ink)",
                  display: "flex",
                  alignItems: "baseline",
                  gap: "0.4rem",
                }}
              >
                {blackCount}
                <span style={{ fontSize: "0.8rem", color: "var(--green, #10B981)", fontWeight: 700 }}>
                  ({blackPercent}%)
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              background: "var(--surface-muted)",
              border: "1px solid var(--line)",
              borderRadius: "12px",
              padding: "1rem 1.25rem",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                background: "var(--yellow-soft, #FEF3C7)",
                border: "1px solid var(--yellow-border, #FDE68A)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--yellow-text, #B45309)",
                flexShrink: 0,
              }}
            >
              <Ghost size={20} />
            </div>
            <div>
              <div style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600 }}>
                Espiões Neutralizados (Gray Page)
              </div>
              <div
                style={{
                  fontSize: "1.35rem",
                  fontWeight: 800,
                  color: "var(--ink)",
                  display: "flex",
                  alignItems: "baseline",
                  gap: "0.4rem",
                }}
              >
                {grayCount}
                <span style={{ fontSize: "0.8rem", color: "var(--yellow-text, #B45309)", fontWeight: 700 }}>
                  ({grayPercent}%)
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              background: "var(--surface-muted)",
              border: "1px solid var(--line)",
              borderRadius: "12px",
              padding: "1rem 1.25rem",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                background: "#EFF6FF",
                border: "1px solid #BFDBFE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#1D4ED8",
                flexShrink: 0,
              }}
            >
              <Bot size={20} />
            </div>
            <div>
              <div style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600 }}>
                Auditores & Bots (White Page)
              </div>
              <div
                style={{
                  fontSize: "1.35rem",
                  fontWeight: 800,
                  color: "var(--ink)",
                  display: "flex",
                  alignItems: "baseline",
                  gap: "0.4rem",
                }}
              >
                {whiteCount}
                <span style={{ fontSize: "0.8rem", color: "#1D4ED8", fontWeight: 700 }}>
                  ({whitePercent}%)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navegação entre Links Blindados e Logs */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          borderBottom: "1px solid var(--line)",
          paddingBottom: "0.5rem",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveSubTab("links")}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "8px",
            fontSize: "0.9rem",
            fontWeight: activeSubTab === "links" ? 700 : 500,
            background: activeSubTab === "links" ? "var(--brand-accent)" : "transparent",
            color: activeSubTab === "links" ? "#FFFFFF" : "var(--ink-secondary)",
            border: "none",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          Links Blindados ({shields.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("logs")}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "8px",
            fontSize: "0.9rem",
            fontWeight: activeSubTab === "logs" ? 700 : 500,
            background: activeSubTab === "logs" ? "var(--brand-accent)" : "transparent",
            color: activeSubTab === "logs" ? "#FFFFFF" : "var(--ink-secondary)",
            border: "none",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          Feed de Bloqueios em Tempo Real ({logs.length})
        </button>
      </div>

      {/* Lista de Links */}
      {activeSubTab === "links" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {shields.length === 0 ? (
            <div
              style={{
                background: "var(--surface)",
                border: "1px dashed var(--line-strong)",
                borderRadius: "16px",
                padding: "3rem 1.5rem",
                textAlign: "center",
              }}
            >
              <ShieldAlert size={44} color="var(--muted)" style={{ margin: "0 auto 1rem" }} />
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--ink)", marginBottom: "0.5rem" }}>
                Nenhum link blindado cadastrado
              </h3>
              <p
                style={{
                  fontSize: "0.9rem",
                  color: "var(--muted)",
                  maxWidth: "480px",
                  margin: "0 auto 1.5rem",
                  lineHeight: "1.5",
                }}
              >
                Crie seu primeiro link protegido com Zero-Redirect. Concorrentes e robôs nunca verão sua VSL real.
              </p>
              <button
                type="button"
                onClick={handleOpenCreate}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.65rem 1.25rem",
                  borderRadius: "10px",
                  background: "var(--brand-accent)",
                  color: "#FFFFFF",
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <Plus size={16} />
                Criar Blindagem Agora
              </button>
            </div>
          ) : (
            shields.map((s) => {
              const publicUrl = getShieldPublicUrl(s);
              const offerName = offers.find((o) => o.id === s.offer_id)?.name || "Oferta Vinculada";
              const isCopied = copiedSlug === s.id;

              return (
                <div
                  key={s.id}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    borderRadius: "14px",
                    padding: "1.25rem",
                    boxShadow: "var(--shadow-sm)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "0.75rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span
                        style={{
                          width: "10px",
                          height: "10px",
                          borderRadius: "50%",
                          background: s.active ? "var(--green, #10B981)" : "var(--muted)",
                          display: "inline-block",
                        }}
                      />
                      <div>
                        <div
                          style={{
                            fontSize: "1.05rem",
                            fontWeight: 700,
                            color: "var(--ink)",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}
                        >
                          {s.name}
                          {s.custom_domain && (
                            <span
                              style={{
                                fontSize: "0.7rem",
                                padding: "2px 8px",
                                borderRadius: "4px",
                                background: "var(--brand-soft)",
                                color: "var(--brand-accent)",
                                border: "1px solid var(--brand-border)",
                                fontWeight: 700,
                              }}
                            >
                              DOMÍNIO PRÓPRIO
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                          Oferta: <strong style={{ color: "var(--ink-secondary)" }}>{offerName}</strong>
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <button
                        type="button"
                        onClick={() => handleToggle(s)}
                        disabled={isPending}
                        style={{
                          padding: "0.35rem 0.75rem",
                          borderRadius: "8px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          border: s.active
                            ? "1px solid var(--green-border, #A7F3D0)"
                            : "1px solid var(--line)",
                          background: s.active
                            ? "var(--green-soft, #ECFDF5)"
                            : "var(--surface-muted)",
                          color: s.active
                            ? "var(--green-text, #047857)"
                            : "var(--muted)",
                        }}
                      >
                        {s.active ? "Blindagem Ativa" : "Pausada"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEdit(s)}
                        title="Editar Configurações"
                        style={{
                          padding: "0.4rem",
                          borderRadius: "8px",
                          background: "var(--surface-muted)",
                          border: "1px solid var(--line)",
                          color: "var(--ink-secondary)",
                          cursor: "pointer",
                        }}
                      >
                        <Settings size={15} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(s.id)}
                        disabled={isPending}
                        title="Excluir Blindagem"
                        style={{
                          padding: "0.4rem",
                          borderRadius: "8px",
                          background: "var(--red-soft, #FEF2F2)",
                          border: "1px solid var(--red-border, #FECACA)",
                          color: "var(--red, #EF3340)",
                          cursor: "pointer",
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Campo de URL para Copiar */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      background: "var(--surface-muted)",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "10px",
                      border: "1px solid var(--line-strong)",
                    }}
                  >
                    <Globe size={16} color="var(--brand-accent)" style={{ flexShrink: 0 }} />
                    <input
                      type="text"
                      readOnly
                      value={publicUrl}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--ink)",
                        fontSize: "0.85rem",
                        fontFamily: "monospace",
                        flex: 1,
                        outline: "none",
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => copyToClipboard(s)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        padding: "0.4rem 0.85rem",
                        borderRadius: "8px",
                        background: isCopied ? "var(--green, #10B981)" : "var(--surface)",
                        border: "1px solid var(--line-strong)",
                        color: isCopied ? "#FFFFFF" : "var(--ink)",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      {isCopied ? <Check size={14} /> : <Copy size={14} />}
                      {isCopied ? "Copiado!" : "Copiar Link para Anúncio"}
                    </button>

                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir no Navegador"
                      style={{
                        padding: "0.4rem",
                        borderRadius: "8px",
                        background: "var(--surface)",
                        border: "1px solid var(--line)",
                        color: "var(--muted)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>

                  {/* As 3 Camadas de Destino (Legíveis e Nítidas) */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: "0.75rem",
                    }}
                  >
                    <div
                      style={{
                        background: "var(--surface-subtle)",
                        padding: "0.65rem 0.85rem",
                        borderRadius: "8px",
                        border: "1px solid var(--line)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          color: "#1D4ED8",
                          marginBottom: "0.25rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.35rem",
                        }}
                      >
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#3B82F6" }} />
                        White Page (Revisores Meta/Google)
                      </div>
                      <div
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--muted)",
                          fontFamily: "monospace",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={s.white_url}
                      >
                        {s.white_url}
                      </div>
                    </div>

                    <div
                      style={{
                        background: "var(--surface-subtle)",
                        padding: "0.65rem 0.85rem",
                        borderRadius: "8px",
                        border: "1px solid var(--line)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          color: "var(--yellow-text, #B45309)",
                          marginBottom: "0.25rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.35rem",
                        }}
                      >
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#F59E0B" }} />
                        Gray Page (Isca Anti-Spy)
                      </div>
                      <div
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--muted)",
                          fontFamily: "monospace",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={s.gray_url}
                      >
                        {s.gray_url}
                      </div>
                    </div>

                    <div
                      style={{
                        background: "var(--surface-subtle)",
                        padding: "0.65rem 0.85rem",
                        borderRadius: "8px",
                        border: "1px solid var(--line)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          color: "var(--green-text, #047857)",
                          marginBottom: "0.25rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.35rem",
                        }}
                      >
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10B981" }} />
                        Black Page (VSL Real com Radar)
                      </div>
                      <div
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--muted)",
                          fontFamily: "monospace",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={s.black_url}
                      >
                        {s.black_url}
                      </div>
                    </div>
                  </div>

                  {/* Badges de Segurança */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {s.block_datacenters && (
                      <span
                        style={{
                          fontSize: "0.75rem",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          background: "var(--surface-muted)",
                          border: "1px solid var(--line)",
                          color: "var(--ink-secondary)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.35rem",
                          fontWeight: 600,
                        }}
                      >
                        <Lock size={12} color="var(--green, #10B981)" />
                        Anti-Datacenter (AWS/GCP/Cloud)
                      </span>
                    )}

                    {s.require_click_id && (
                      <span
                        style={{
                          fontSize: "0.75rem",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          background: "var(--surface-muted)",
                          border: "1px solid var(--line)",
                          color: "var(--ink-secondary)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.35rem",
                          fontWeight: 600,
                        }}
                      >
                        <Lock size={12} color="var(--green, #10B981)" />
                        Exige Click ID (fbclid/gclid)
                      </span>
                    )}

                    {s.block_unknown_user_agents && (
                      <span
                        style={{
                          fontSize: "0.75rem",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          background: "var(--surface-muted)",
                          border: "1px solid var(--line)",
                          color: "var(--ink-secondary)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.35rem",
                          fontWeight: 600,
                        }}
                      >
                        <Lock size={12} color="var(--green, #10B981)" />
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
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "14px",
            overflow: "hidden",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {logs.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "var(--muted)", fontSize: "0.9rem" }}>
              Nenhum acesso registrado ainda. Assim que seus links blindados receberem cliques de anúncios ou espiões, as decisões em tempo real aparecerão aqui.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "var(--surface-muted)", borderBottom: "1px solid var(--line)", color: "var(--muted)" }}>
                    <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Data/Hora</th>
                    <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Veredito</th>
                    <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Motivo</th>
                    <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>IP (LGPD)</th>
                    <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Datacenter?</th>
                    <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>User-Agent</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.slice(0, 50).map((l) => (
                    <tr
                      key={l.id}
                      style={{
                        borderBottom: "1px solid var(--line)",
                        color: "var(--ink)",
                      }}
                    >
                      <td style={{ padding: "0.75rem 1rem", whiteSpace: "nowrap", color: "var(--muted)" }}>
                        {new Date(l.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", whiteSpace: "nowrap" }}>
                        {l.verdict === "black" && (
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: "4px",
                              background: "var(--green-soft)",
                              color: "var(--green-text)",
                              fontWeight: 700,
                              fontSize: "0.75rem",
                              border: "1px solid var(--green-border)",
                            }}
                          >
                            BLACK (Lead Real)
                          </span>
                        )}
                        {l.verdict === "gray" && (
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: "4px",
                              background: "var(--yellow-soft)",
                              color: "var(--yellow-text)",
                              fontWeight: 700,
                              fontSize: "0.75rem",
                              border: "1px solid var(--yellow-border)",
                            }}
                          >
                            GRAY (Isca / Espião)
                          </span>
                        )}
                        {l.verdict === "white" && (
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: "4px",
                              background: "#EFF6FF",
                              color: "#1D4ED8",
                              fontWeight: 700,
                              fontSize: "0.75rem",
                              border: "1px solid #BFDBFE",
                            }}
                          >
                            WHITE (Revisor)
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>{l.reason}</td>
                      <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", color: "var(--muted)" }}>
                        {l.ip_masked || "-"}
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        {l.is_datacenter ? (
                          <span style={{ color: "#D97706", fontWeight: 700 }}>Sim (Cloud)</span>
                        ) : (
                          <span style={{ color: "var(--muted)" }}>Não (Residencial)</span>
                        )}
                      </td>
                      <td
                        style={{
                          padding: "0.75rem 1rem",
                          maxWidth: "280px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          color: "var(--muted)",
                        }}
                        title={l.user_agent || ""}
                      >
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

      {/* Modal Criar / Editar Blindagem — Design Nativo e Totalmente Legível */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Configurar Blindagem"
            style={{ width: "min(100%, 640px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              type="button"
              aria-label="Fechar"
              onClick={() => setShowModal(false)}
            >
              ✕
            </button>

            <span className="tag">TRACKBASE SHIELD</span>
            <h2>{editingShield ? "Editar Blindagem de Oferta" : "Nova Blindagem de Oferta"}</h2>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1.25rem" }}>
              Sua página carrega instantaneamente sem redirecionamentos visíveis. A oferta verdadeira só é liberada para quem veio dos seus anúncios oficiais.
            </p>

            {errorMsg && (
              <div
                style={{
                  background: "var(--red-soft, #FEF2F2)",
                  border: "1px solid var(--red-border, #FECACA)",
                  color: "var(--red-text, #B91C1C)",
                  padding: "0.75rem 1rem",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  marginBottom: "1rem",
                }}
              >
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <label>
                  Nome da Campanha
                  <input
                    type="text"
                    name="name"
                    required
                    defaultValue={editingShield?.name || ""}
                    placeholder="Ex: VSL Nutra Escala"
                  />
                </label>

                <label>
                  Oferta Vinculada
                  <select
                    name="offer_id"
                    required
                    defaultValue={editingShield?.offer_id || offers[0]?.id || ""}
                  >
                    {offers.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Slug Padrão */}
              <label>
                Slug do Link (Rota Padrão)
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    background: "var(--surface-muted)",
                    border: "1px solid var(--line-strong)",
                    borderRadius: "8px",
                    padding: "0 0.5rem",
                  }}
                >
                  <span style={{ fontSize: "0.82rem", color: "var(--muted)", fontFamily: "monospace" }}>
                    {appUrl}/s/
                  </span>
                  <input
                    type="text"
                    name="slug"
                    required
                    defaultValue={editingShield?.slug || ""}
                    placeholder="promo-segura-2026"
                    style={{
                      border: "none",
                      background: "transparent",
                      flex: 1,
                      padding: "8px",
                      fontFamily: "monospace",
                    }}
                  />
                </div>
              </label>

              {/* Domínio Próprio (CNAME) */}
              <div>
                <label>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Domínio Próprio / Subdomínio (Opcional - White Label)</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--brand-accent)", fontWeight: 700 }}>
                      100% PERSONALIZADO
                    </span>
                  </div>
                  <input
                    type="text"
                    name="custom_domain"
                    defaultValue={editingShield?.custom_domain || ""}
                    placeholder="Ex: oferta.meusite.com ou promo.suamarca.com.br"
                  />
                </label>
                <div
                  onClick={() => setShowDnsModal(true)}
                  style={{
                    cursor: "pointer",
                    marginTop: "6px",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    background: "var(--brand-soft, #F3F0FF)",
                    border: "1px dashed var(--brand-border, #DDD6FE)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.5rem",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--brand-text, #3B1E78)",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                    }}
                  >
                    <Globe size={14} color="var(--brand-accent)" />
                    Dúvida de como apontar no Cloudflare, Hostinger ou Registro.br?
                  </span>
                  <span
                    style={{
                      fontSize: "0.78rem",
                      color: "var(--brand-accent)",
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      gap: "2px",
                      flexShrink: 0,
                    }}
                  >
                    Ver Guia Passo a Passo →
                  </span>
                </div>
              </div>

              {/* As 3 URLs */}
              <div
                style={{
                  background: "var(--surface-subtle)",
                  border: "1px solid var(--line)",
                  borderRadius: "10px",
                  padding: "1rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.85rem",
                }}
              >
                <label>
                  <span style={{ color: "#1D4ED8", fontWeight: 700 }}>
                    1. URL da White Page (Página Segura para Revisores da Meta/Google)
                  </span>
                  <input
                    type="url"
                    name="white_url"
                    required
                    defaultValue={editingShield?.white_url || ""}
                    placeholder="https://meublog.com/artigo-educativo"
                  />
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 400 }}>
                    Artigo de blog neutro ou termos de uso 100% complacente com as diretrizes de anúncios.
                  </span>
                </label>

                <label>
                  <span style={{ color: "var(--yellow-text, #B45309)", fontWeight: 700 }}>
                    2. URL da Gray Page (Isca para Espiões & Scrapers do AdHeart)
                  </span>
                  <input
                    type="url"
                    name="gray_url"
                    required
                    defaultValue={editingShield?.gray_url || ""}
                    placeholder="https://meusite.com/ebook-gratis-isca"
                  />
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 400 }}>
                    Página alternativa que ferramentas de espionagem vão clonar achando que é sua oferta real.
                  </span>
                </label>

                <label>
                  <span style={{ color: "var(--green-text, #047857)", fontWeight: 700 }}>
                    3. URL da Black Page (Sua VSL Real de Alta Conversão)
                  </span>
                  <input
                    type="url"
                    name="black_url"
                    required
                    defaultValue={editingShield?.black_url || ""}
                    placeholder="https://oferta-secreta.com/vsl"
                  />
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 400 }}>
                    Sua página de vendas verdadeira. O Trackbase conecta automaticamente o Radar de Atenção dos Leads e o envio de conversões para o Facebook Ads.
                  </span>
                </label>
              </div>

              {/* Regras de Segurança e Filtragem com Toggle Switches Modernos */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.65rem",
                  marginTop: "0.25rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span
                    style={{
                      fontSize: "0.84rem",
                      fontWeight: 700,
                      color: "var(--ink)",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                    }}
                  >
                    <Lock size={15} color="var(--brand-accent)" />
                    Regras de Filtragem & Camada Anti-Espião
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                    Clique no card para ativar/desativar
                  </span>
                </div>

                <input type="hidden" name="block_datacenters" value={blockDc ? "true" : "false"} />
                <input type="hidden" name="require_click_id" value={requireClickId ? "true" : "false"} />
                <input
                  type="hidden"
                  name="block_unknown_user_agents"
                  value={blockUa ? "true" : "false"}
                />

                {/* Card 1: Bloquear Data Centers */}
                <div
                  onClick={() => setBlockDc(!blockDc)}
                  style={{
                    background: blockDc ? "rgba(91, 52, 234, 0.03)" : "var(--surface)",
                    border: blockDc ? "1.5px solid var(--brand-accent)" : "1px solid var(--line)",
                    borderRadius: "10px",
                    padding: "0.75rem 0.9rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.85rem",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "0.7rem", flex: 1 }}>
                    <div
                      style={{
                        width: "34px",
                        height: "34px",
                        borderRadius: "8px",
                        background: blockDc ? "var(--brand-soft)" : "var(--surface-muted)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: "2px",
                      }}
                    >
                      <Server size={17} color={blockDc ? "var(--brand-accent)" : "var(--muted)"} />
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.15rem" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.86rem", color: "var(--ink)" }}>
                          Bloquear Servidores & Data Centers
                        </span>
                        <span
                          style={{
                            fontSize: "0.65rem",
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: "9999px",
                            background: "var(--green-soft)",
                            color: "var(--green-text)",
                            border: "1px solid var(--green-border)",
                          }}
                        >
                          Recomendado
                        </span>
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--ink-secondary)", lineHeight: "1.35" }}>
                        Entrega a <strong>Gray Page (Isca Falsa)</strong> para qualquer IP de servidor (AWS, Google Cloud, DigitalOcean, Hetzner, etc.), onde operam os espiões.
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      width: "40px",
                      height: "22px",
                      borderRadius: "9999px",
                      background: blockDc ? "var(--brand-accent)" : "var(--line-strong)",
                      position: "relative",
                      flexShrink: 0,
                      transition: "background 0.2s ease",
                    }}
                  >
                    <div
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        background: "#FFFFFF",
                        position: "absolute",
                        top: "3px",
                        left: blockDc ? "21px" : "3px",
                        transition: "left 0.2s ease",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                      }}
                    />
                  </div>
                </div>

                {/* Card 2: Exigir Click ID */}
                <div
                  onClick={() => setRequireClickId(!requireClickId)}
                  style={{
                    background: requireClickId ? "rgba(91, 52, 234, 0.03)" : "var(--surface)",
                    border: requireClickId ? "1.5px solid var(--brand-accent)" : "1px solid var(--line)",
                    borderRadius: "10px",
                    padding: "0.75rem 0.9rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.85rem",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "0.7rem", flex: 1 }}>
                    <div
                      style={{
                        width: "34px",
                        height: "34px",
                        borderRadius: "8px",
                        background: requireClickId ? "var(--green-soft)" : "var(--surface-muted)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: "2px",
                      }}
                    >
                      <MousePointerClick size={17} color={requireClickId ? "var(--green, #10B981)" : "var(--muted)"} />
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.15rem" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.86rem", color: "var(--ink)" }}>
                          Exigir Click ID Oficial de Anúncio
                        </span>
                        <span
                          style={{
                            fontSize: "0.65rem",
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: "9999px",
                            background: "var(--brand-soft)",
                            color: "var(--brand-accent)",
                            border: "1px solid var(--brand-border)",
                          }}
                        >
                          Anti-Curiosos
                        </span>
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--ink-secondary)", lineHeight: "1.35" }}>
                        Entrega a <strong>Black Page (VSL Real)</strong> somente para leads com parâmetros oficiais de anúncio (
                        <span style={{ display: "inline-block", background: "var(--surface-muted)", padding: "0 4px", borderRadius: "3px", fontSize: "0.72rem", fontFamily: "monospace", color: "var(--brand-accent)" }}>fbclid</span>,{" "}
                        <span style={{ display: "inline-block", background: "var(--surface-muted)", padding: "0 4px", borderRadius: "3px", fontSize: "0.72rem", fontFamily: "monospace", color: "var(--brand-accent)" }}>gclid</span> ou{" "}
                        <span style={{ display: "inline-block", background: "var(--surface-muted)", padding: "0 4px", borderRadius: "3px", fontSize: "0.72rem", fontFamily: "monospace", color: "var(--brand-accent)" }}>ttclid</span>
                        ). Acessos diretos ou sem anúncio veem a Gray Page (isca).
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      width: "40px",
                      height: "22px",
                      borderRadius: "9999px",
                      background: requireClickId ? "var(--brand-accent)" : "var(--line-strong)",
                      position: "relative",
                      flexShrink: 0,
                      transition: "background 0.2s ease",
                    }}
                  >
                    <div
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        background: "#FFFFFF",
                        position: "absolute",
                        top: "3px",
                        left: requireClickId ? "21px" : "3px",
                        transition: "left 0.2s ease",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                      }}
                    />
                  </div>
                </div>

                {/* Card 3: Headless & Scrapers */}
                <div
                  onClick={() => setBlockUa(!blockUa)}
                  style={{
                    background: blockUa ? "rgba(91, 52, 234, 0.03)" : "var(--surface)",
                    border: blockUa ? "1.5px solid var(--brand-accent)" : "1px solid var(--line)",
                    borderRadius: "10px",
                    padding: "0.75rem 0.9rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.85rem",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "0.7rem", flex: 1 }}>
                    <div
                      style={{
                        width: "34px",
                        height: "34px",
                        borderRadius: "8px",
                        background: blockUa ? "var(--yellow-soft)" : "var(--surface-muted)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: "2px",
                      }}
                    >
                      <Bot size={17} color={blockUa ? "var(--yellow-text, #B45309)" : "var(--muted)"} />
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.15rem" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.86rem", color: "var(--ink)" }}>
                          Bloquear Headless Browsers & Spy Tools
                        </span>
                        <span
                          style={{
                            fontSize: "0.65rem",
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: "9999px",
                            background: "var(--yellow-soft)",
                            color: "var(--yellow-text)",
                            border: "1px solid var(--yellow-border)",
                          }}
                        >
                          Anti-Robôs
                        </span>
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--ink-secondary)", lineHeight: "1.35" }}>
                        Neutraliza ferramentas de espionagem automatizadas (AdHeart, SpyPush), navegadores sem tela (Puppeteer, Playwright) e scripts Python.
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      width: "40px",
                      height: "22px",
                      borderRadius: "9999px",
                      background: blockUa ? "var(--brand-accent)" : "var(--line-strong)",
                      position: "relative",
                      flexShrink: 0,
                      transition: "background 0.2s ease",
                    }}
                  >
                    <div
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        background: "#FFFFFF",
                        position: "absolute",
                        top: "3px",
                        left: blockUa ? "21px" : "3px",
                        transition: "left 0.2s ease",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Botões do Modal */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: "0.75rem",
                  paddingTop: "0.5rem",
                }}
              >
                <button
                  type="button"
                  className="button"
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="button primary"
                  style={{ background: "var(--brand-accent)" }}
                >
                  {isPending ? "Salvando..." : editingShield ? "Salvar Alterações" : "Criar Blindagem"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Modal Guia Passo a Passo de Domínio Próprio (CNAME) */}
      {showDnsModal && (
        <div className="modal-backdrop" onClick={() => setShowDnsModal(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Guia Passo a Passo de Domínio Próprio"
            style={{ width: "min(100%, 680px)", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              type="button"
              aria-label="Fechar"
              onClick={() => setShowDnsModal(false)}
            >
              ✕
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <span
                className="tag"
                style={{
                  background: "var(--brand-soft)",
                  color: "var(--brand-accent)",
                  borderColor: "var(--brand-border)",
                }}
              >
                GUIA OFICIAL • DOMÍNIO PRÓPRIO
              </span>
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "var(--green-text)",
                  fontWeight: 700,
                  background: "var(--green-soft)",
                  padding: "2px 8px",
                  borderRadius: "9999px",
                  border: "1px solid var(--green-border)",
                }}
              >
                100% White Label
              </span>
            </div>

            <h2
              style={{
                fontSize: "1.35rem",
                fontWeight: 800,
                color: "var(--ink)",
                marginBottom: "0.4rem",
              }}
            >
              Como Apontar seu Domínio Próprio via CNAME
            </h2>
            <p
              style={{
                color: "var(--ink-secondary)",
                fontSize: "0.88rem",
                lineHeight: "1.5",
                marginBottom: "1.25rem",
              }}
            >
              Ao configurar um CNAME, seus links de anúncios rodam sob o seu próprio endereço (ex:{" "}
              <code style={{ color: "var(--brand-accent)", fontWeight: 700 }}>
                oferta.seudominio.com
              </code>
              ). Os robôs de anúncios e curiosos nunca verão a URL do Trackbase na barra de
              navegação!
            </p>

            {/* Caixa de Registros para Copiar em 1 Clique */}
            <div
              style={{
                background: "var(--surface-subtle)",
                border: "1px solid var(--line)",
                borderRadius: "12px",
                padding: "1.15rem",
                marginBottom: "1.25rem",
              }}
            >
              <div
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--ink)",
                  marginBottom: "0.75rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <Copy size={14} color="var(--brand-accent)" />
                  Registros DNS para Inserir no seu Provedor
                </span>
                <span
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--muted)",
                    textTransform: "none",
                    fontWeight: 500,
                  }}
                >
                  Clique para copiar
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: "0.75rem",
                }}
              >
                {/* Tipo */}
                <div
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    borderRadius: "8px",
                    padding: "0.6rem 0.75rem",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--muted)",
                      fontWeight: 600,
                      marginBottom: "2px",
                    }}
                  >
                    TIPO DE REGISTRO
                  </div>
                  <div
                    style={{
                      fontSize: "0.95rem",
                      fontWeight: 800,
                      color: "var(--ink)",
                      fontFamily: "monospace",
                    }}
                  >
                    CNAME
                  </div>
                </div>

                {/* Nome / Host */}
                <div
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    borderRadius: "8px",
                    padding: "0.6rem 0.75rem",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--muted)",
                      fontWeight: 600,
                      marginBottom: "2px",
                    }}
                  >
                    NOME / HOST (SUBDOMÍNIO)
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.95rem",
                        fontWeight: 800,
                        color: "var(--brand-accent)",
                        fontFamily: "monospace",
                      }}
                    >
                      oferta
                    </span>
                    <button
                      type="button"
                      onClick={() => copyDnsValue("oferta", "host")}
                      style={{
                        background:
                          copiedDnsKey === "host" ? "var(--green-soft)" : "var(--surface-muted)",
                        border: "1px solid var(--line)",
                        borderRadius: "5px",
                        padding: "3px 6px",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        color: copiedDnsKey === "host" ? "var(--green-text)" : "var(--ink)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "3px",
                      }}
                    >
                      {copiedDnsKey === "host" ? <Check size={12} /> : <Copy size={12} />}
                      {copiedDnsKey === "host" ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                </div>

                {/* Destino / Valor */}
                <div
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    borderRadius: "8px",
                    padding: "0.6rem 0.75rem",
                    gridColumn: "span 2",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--muted)",
                      fontWeight: 600,
                      marginBottom: "2px",
                    }}
                  >
                    DESTINO / VALOR (APONTA PARA)
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.92rem",
                        fontWeight: 800,
                        color: "var(--ink)",
                        fontFamily: "monospace",
                        overflowWrap: "anywhere",
                      }}
                    >
                      cname.trackbase.com.br
                    </span>
                    <button
                      type="button"
                      onClick={() => copyDnsValue("cname.trackbase.com.br", "target")}
                      style={{
                        background:
                          copiedDnsKey === "target" ? "var(--green-soft)" : "var(--brand-accent)",
                        border: "none",
                        borderRadius: "5px",
                        padding: "5px 10px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: "#FFFFFF",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        flexShrink: 0,
                      }}
                    >
                      {copiedDnsKey === "target" ? <Check size={13} /> : <Copy size={13} />}
                      {copiedDnsKey === "target" ? "Copiado!" : "Copiar Destino"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Aviso Crítico Cloudflare */}
              <div
                style={{
                  marginTop: "0.85rem",
                  background: "#FFFBEB",
                  border: "1px solid #FDE68A",
                  borderRadius: "8px",
                  padding: "0.65rem 0.85rem",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.6rem",
                }}
              >
                <AlertTriangle
                  size={16}
                  color="#D97706"
                  style={{ marginTop: "2px", flexShrink: 0 }}
                />
                <div style={{ fontSize: "0.78rem", color: "#92400E", lineHeight: "1.4" }}>
                  <strong>Regra de Ouro da Cloudflare:</strong> Desative o Proxy Laranja (deixe a
                  nuvem <strong>CINZA / Apenas DNS</strong>). Se a nuvem laranja ficar ativa,
                  ocorrerá conflito de SSL e o Zero-Redirect não funcionará.
                </div>
              </div>
            </div>

            {/* Seletor de Plataforma */}
            <div style={{ marginBottom: "1rem" }}>
              <div
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  color: "var(--ink)",
                  marginBottom: "0.5rem",
                }}
              >
                Selecione onde seu domínio está gerenciado:
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {[
                  { key: "cloudflare", label: "🟠 Cloudflare" },
                  { key: "hostinger", label: "🟣 Hostinger" },
                  { key: "registrobr", label: "🟢 Registro.br" },
                  { key: "godaddy", label: "🔵 GoDaddy & Outros" },
                ].map((plat) => (
                  <button
                    key={plat.key}
                    type="button"
                    onClick={() => setDnsPlatformTab(plat.key as typeof dnsPlatformTab)}
                    style={{
                      padding: "0.5rem 0.9rem",
                      borderRadius: "8px",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      border:
                        dnsPlatformTab === plat.key
                          ? "1.5px solid var(--brand-accent)"
                          : "1px solid var(--line)",
                      background:
                        dnsPlatformTab === plat.key ? "var(--brand-soft)" : "var(--surface)",
                      color:
                        dnsPlatformTab === plat.key ? "var(--brand-accent)" : "var(--ink)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {plat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Conteúdo Passo a Passo por Plataforma */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: "10px",
                padding: "1rem 1.15rem",
                marginBottom: "1.25rem",
              }}
            >
              {dnsPlatformTab === "cloudflare" && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.65rem",
                    fontSize: "0.83rem",
                    color: "var(--ink-secondary)",
                    lineHeight: "1.5",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      color: "var(--ink)",
                      fontSize: "0.9rem",
                      marginBottom: "0.25rem",
                    }}
                  >
                    Passo a passo no Cloudflare:
                  </div>
                  <div>
                    <strong>1.</strong> Acesse sua conta na Cloudflare e clique sobre o seu domínio.
                  </div>
                  <div>
                    <strong>2.</strong> No menu lateral esquerdo, clique em <strong>DNS</strong> e
                    depois em <strong>Registros (Records)</strong>.
                  </div>
                  <div>
                    <strong>3.</strong> Clique no botão azul{" "}
                    <strong>Adicionar registro (+ Add record)</strong>.
                  </div>
                  <div>
                    <strong>4.</strong> Em <strong>Tipo</strong>, selecione <code>CNAME</code>.
                  </div>
                  <div>
                    <strong>5.</strong> Em <strong>Nome</strong>, digite o prefixo desejado (ex:{" "}
                    <code>oferta</code>).
                  </div>
                  <div>
                    <strong>6.</strong> Em <strong>Destino</strong>, cole exatamente:{" "}
                    <code>cname.trackbase.com.br</code>.
                  </div>
                  <div>
                    <strong>7. ATENÇÃO:</strong> Clique no botão de{" "}
                    <strong>Status do Proxy</strong> para que a nuvem fique{" "}
                    <strong>CINZA (Apenas DNS / DNS Only)</strong>.
                  </div>
                  <div>
                    <strong>8.</strong> Clique em <strong>Salvar</strong>. Em 2 a 5 minutos estará
                    propagado!
                  </div>
                </div>
              )}

              {dnsPlatformTab === "hostinger" && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.65rem",
                    fontSize: "0.83rem",
                    color: "var(--ink-secondary)",
                    lineHeight: "1.5",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      color: "var(--ink)",
                      fontSize: "0.9rem",
                      marginBottom: "0.25rem",
                    }}
                  >
                    Passo a passo no hPanel da Hostinger:
                  </div>
                  <div>
                    <strong>1.</strong> Acesse sua conta na Hostinger e vá na seção{" "}
                    <strong>Domínios</strong>.
                  </div>
                  <div>
                    <strong>2.</strong> Clique em <strong>Gerenciar</strong> ao lado do domínio que
                    você vai usar.
                  </div>
                  <div>
                    <strong>3.</strong> No menu lateral, clique em{" "}
                    <strong>DNS / Servidores de Nomes</strong>.
                  </div>
                  <div>
                    <strong>4.</strong> Na seção &quot;Adicionar registro DNS&quot;, selecione o Tipo:{" "}
                    <code>CNAME</code>.
                  </div>
                  <div>
                    <strong>5.</strong> No campo <strong>Nome</strong>, digite apenas o prefixo (ex:{" "}
                    <code>oferta</code>).
                  </div>
                  <div>
                    <strong>6.</strong> No campo <strong>Aponta para</strong>, cole:{" "}
                    <code>cname.trackbase.com.br</code>.
                  </div>
                  <div>
                    <strong>7.</strong> Mantenha o TTL padrão (14400) e clique no botão roxo{" "}
                    <strong>Adicionar Registro</strong>.
                  </div>
                </div>
              )}

              {dnsPlatformTab === "registrobr" && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.65rem",
                    fontSize: "0.83rem",
                    color: "var(--ink-secondary)",
                    lineHeight: "1.5",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      color: "var(--ink)",
                      fontSize: "0.9rem",
                      marginBottom: "0.25rem",
                    }}
                  >
                    Passo a passo no Registro.br:
                  </div>
                  <div>
                    <strong>1.</strong> Faça login no Registro.br e clique sobre o seu domínio na
                    lista.
                  </div>
                  <div>
                    <strong>2.</strong> Role até a seção <strong>DNS</strong> e clique em{" "}
                    <strong>Editar Zona</strong> (ou Configurar Endereçamento).
                  </div>
                  <div>
                    <strong>3.</strong> Clique no botão <strong>+ Nova Entrada</strong>.
                  </div>
                  <div>
                    <strong>4.</strong> No primeiro campo, selecione o tipo <code>CNAME</code>.
                  </div>
                  <div>
                    <strong>5.</strong> No campo de nome, digite seu subdomínio (ex:{" "}
                    <code>oferta</code>).
                  </div>
                  <div>
                    <strong>6.</strong> No campo de destino, cole:{" "}
                    <code>cname.trackbase.com.br.</code> (com o ponto final caso o painel exija).
                  </div>
                  <div>
                    <strong>7.</strong> Clique em <strong>Salvar Alterações</strong> no topo da
                    página.
                  </div>
                </div>
              )}

              {dnsPlatformTab === "godaddy" && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.65rem",
                    fontSize: "0.83rem",
                    color: "var(--ink-secondary)",
                    lineHeight: "1.5",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      color: "var(--ink)",
                      fontSize: "0.9rem",
                      marginBottom: "0.25rem",
                    }}
                  >
                    Passo a passo no GoDaddy / Namecheap:
                  </div>
                  <div>
                    <strong>1.</strong> Acesse sua conta na registradora e vá até a área de{" "}
                    <strong>Gerenciamento de DNS</strong> do domínio.
                  </div>
                  <div>
                    <strong>2.</strong> Clique em <strong>Adicionar (Add Record)</strong>.
                  </div>
                  <div>
                    <strong>3.</strong> Selecione o Tipo: <code>CNAME</code>.
                  </div>
                  <div>
                    <strong>4.</strong> No campo <strong>Host / Nome</strong>, insira:{" "}
                    <code>oferta</code>.
                  </div>
                  <div>
                    <strong>5.</strong> No campo <strong>Valor / Points To</strong>, cole:{" "}
                    <code>cname.trackbase.com.br</code>.
                  </div>
                  <div>
                    <strong>6.</strong> Deixe o TTL como padrão (1 hora) e clique em{" "}
                    <strong>Salvar</strong>.
                  </div>
                </div>
              )}
            </div>

            {/* Etapa Final no Trackbase */}
            <div
              style={{
                background: "var(--brand-soft)",
                border: "1px solid var(--brand-border)",
                borderRadius: "10px",
                padding: "0.85rem 1rem",
                display: "flex",
                alignItems: "flex-start",
                gap: "0.65rem",
                marginBottom: "1.25rem",
              }}
            >
              <CheckCircle2
                size={18}
                color="var(--brand-accent)"
                style={{ marginTop: "2px", flexShrink: 0 }}
              />
              <div style={{ fontSize: "0.82rem", color: "var(--brand-text)", lineHeight: "1.4" }}>
                <strong>Último Passo:</strong> Após criar o CNAME na sua hospedagem, volte na sua
                blindagem e insira o domínio completo no campo <strong>Domínio Próprio</strong>{" "}
                (exemplo: <code style={{ fontWeight: 700 }}>oferta.seusite.com</code>). O
                Trackbase responderá imediatamente por ele com Zero-Redirect!
              </div>
            </div>

            {/* Botão de Fechar */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="button primary"
                onClick={() => setShowDnsModal(false)}
                style={{ background: "var(--brand-accent)", padding: "0.65rem 1.5rem" }}
              >
                Entendi, Fechar Guia
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
