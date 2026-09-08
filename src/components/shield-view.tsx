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

  // Estatísticas agregadas dos logs
  const totalLogs = logs.length;
  const blackCount = logs.filter((l) => l.verdict === "black").length;
  const grayCount = logs.filter((l) => l.verdict === "gray").length;
  const whiteCount = logs.filter((l) => l.verdict === "white").length;

  const blackPercent = totalLogs ? Math.round((blackCount / totalLogs) * 100) : 0;
  const grayPercent = totalLogs ? Math.round((grayCount / totalLogs) * 100) : 0;
  const whitePercent = totalLogs ? Math.round((whiteCount / totalLogs) * 100) : 0;

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
              TRACKBASE SHIELD • ZERO-REDIRECT & ANTI-SPY
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
              Nossa tecnologia de borda inspeciona cada clique em menos de 10ms.
              Revisores de anúncios veem a{" "}
              <strong style={{ color: "#2563EB" }}>White Page (Artigo Seguro)</strong>,
              ferramentas de espionagem (AdHeart, bots) caem na{" "}
              <strong style={{ color: "#D97706" }}>Gray Page (Isca Falsa)</strong>, e apenas leads
              humanos reais veem sua{" "}
              <strong style={{ color: "var(--green, #10B981)" }}>Black Page (VSL Real)</strong>.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
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
                <p style={{ fontSize: "0.82rem", color: "var(--muted)", lineHeight: "1.4" }}>
                  Você pode usar o link padrão do Trackbase ou apontar um <strong>CNAME</strong> no
                  seu domínio (ex: <code>oferta.seusite.com</code>) apontando para o Trackbase.
                  Assim seus anúncios rodam no seu próprio domínio com 100% de autoridade.
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
                  Cole o link blindado no Meta Ads ou TikTok. O Shield faz o <strong>Zero-Redirect</strong>{" "}
                  (sem saltos de tela branca) e <strong>injeta automaticamente o Radar de Leads</strong>{" "}
                  (rolagem 25/50/75/90%) e o CAPI na sua página!
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
              Configure a entrega com Zero-Redirect. A oferta real só é exibida para leads qualificados de anúncios pagos.
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
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "2px", fontWeight: 400 }}>
                  Aponte um CNAME de <strong>oferta</strong> para o seu app. O cliente verá apenas o seu domínio no anúncio!
                </span>
              </label>

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
                    Sua página de vendas verdadeira. O Trackbase auto-injeta o Radar de Leads (scroll 25/50/75/90%) e CAPI!
                  </span>
                </label>
              </div>

              {/* Regras de Segurança com Checkboxes Perfeitamente Alinhados */}
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: "10px",
                  padding: "1rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--ink)", marginBottom: "0.25rem" }}>
                  Regras de Segurança e Filtragem:
                </div>

                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.65rem" }}>
                  <input
                    type="checkbox"
                    id="chk_dc"
                    name="block_datacenters"
                    defaultChecked={editingShield ? editingShield.block_datacenters : true}
                    style={{ width: "16px", height: "16px", marginTop: "2px", flexShrink: 0, cursor: "pointer" }}
                  />
                  <label htmlFor="chk_dc" style={{ cursor: "pointer", fontWeight: 400, color: "var(--ink-secondary)" }}>
                    <strong style={{ color: "var(--ink)" }}>Bloquear Data Centers:</strong> Entrega a Gray Page (Isca) para qualquer IP de servidor ou proxy (AWS, Google Cloud, DigitalOcean, Hetzner, etc.).
                  </label>
                </div>

                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.65rem" }}>
                  <input
                    type="checkbox"
                    id="chk_click"
                    name="require_click_id"
                    defaultChecked={editingShield ? editingShield.require_click_id : true}
                    style={{ width: "16px", height: "16px", marginTop: "2px", flexShrink: 0, cursor: "pointer" }}
                  />
                  <label htmlFor="chk_click" style={{ cursor: "pointer", fontWeight: 400, color: "var(--ink-secondary)" }}>
                    <strong style={{ color: "var(--ink)" }}>Exigir Click ID:</strong> Entrega a Black Page somente se a requisição trouxer <code>fbclid</code>, <code>gclid</code> ou token de anúncio oficial.
                  </label>
                </div>

                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.65rem" }}>
                  <input
                    type="checkbox"
                    id="chk_ua"
                    name="block_unknown_user_agents"
                    defaultChecked={editingShield ? editingShield.block_unknown_user_agents : true}
                    style={{ width: "16px", height: "16px", marginTop: "2px", flexShrink: 0, cursor: "pointer" }}
                  />
                  <label htmlFor="chk_ua" style={{ cursor: "pointer", fontWeight: 400, color: "var(--ink-secondary)" }}>
                    <strong style={{ color: "var(--ink)" }}>Bloquear Headless & Scrapers:</strong> Neutraliza ferramentas de espionagem automatizadas (AdHeart, Puppeteer, Playwright, Python).
                  </label>
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
    </div>
  );
}
