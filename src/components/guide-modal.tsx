"use client";

import React, { useState, useEffect } from "react";
import {
  Radio,
  ShieldCheck,
  Link2,
  Plug,
  Zap,
  Volume2,
  X,
  Check,
  Copy,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "radar" | "shield" | "utm" | "gateway" | "capi" | "alertas";
  onNavigateTab?: (tabId: string) => void;
}

export function GuideModal({
  isOpen,
  onClose,
  initialTab = "radar",
  onNavigateTab,
}: GuideModalProps) {
  const [activeTab, setActiveTab] = useState<
    "radar" | "shield" | "utm" | "gateway" | "capi" | "alertas"
  >(initialTab);
  const [copiedScript, setCopiedScript] = useState(false);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const tabs = [
    {
      id: "radar" as const,
      label: "Radar de Leads",
      icon: Radio,
      badge: "Tempo Real",
      desc: "Sessões ao vivo & Mapa de Rolagem",
    },
    {
      id: "shield" as const,
      label: "Shield Anti-Bloqueio",
      icon: ShieldCheck,
      badge: "Cloaker & DNS",
      desc: "Proteção de ofertas e domínio CNAME",
    },
    {
      id: "utm" as const,
      label: "Gerador de Links UTM",
      icon: Link2,
      badge: "1 Clique",
      desc: "Meta Ads, Google, TikTok e Zap",
    },
    {
      id: "gateway" as const,
      label: "Gateways & Webhooks",
      icon: Plug,
      badge: "Vendas",
      desc: "Kiwify, Hotmart, Cakto e outros",
    },
    {
      id: "capi" as const,
      label: "API de Conversões Meta",
      icon: Zap,
      badge: "CAPI",
      desc: "Envio de compras e Event Quality",
    },
    {
      id: "alertas" as const,
      label: "Alertas & Notificações",
      icon: Volume2,
      badge: "Push & Som",
      desc: "Som de venda e avisos no celular",
    },
  ];

  return (
    <div
      className="modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Central de Tutoriais e Passo a Passo"
        style={{
          width: "min(100%, 940px)",
          maxHeight: "90vh",
          background: "var(--surface, #FFFFFF)",
          borderRadius: "18px",
          border: "1px solid var(--line, #E2E8F0)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header do Modal */}
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid var(--line, #E2E8F0)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--surface-subtle, #F8FAFC)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "10px",
                background: "linear-gradient(135deg, #5B34EA, #7C3AED)",
                color: "#FFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <h2
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 800,
                  margin: 0,
                  color: "var(--ink, #0F172A)",
                }}
              >
                Guia Passo a Passo Oficial
              </h2>
              <p
                style={{
                  fontSize: "0.82rem",
                  color: "var(--muted, #64748B)",
                  margin: 0,
                }}
              >
                Aprenda a configurar e usar 100% das ferramentas do Trackbase
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0.4rem",
              borderRadius: "8px",
              color: "var(--muted, #64748B)",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Corpo: Navegação Lateral + Conteúdo */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "260px 1fr",
            minHeight: "520px",
            overflow: "hidden",
          }}
        >
          {/* Menu Lateral de Abas */}
          <nav
            style={{
              borderRight: "1px solid var(--line, #E2E8F0)",
              background: "var(--surface-subtle, #F8FAFC)",
              padding: "1rem 0.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              overflowY: "auto",
            }}
          >
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                letterSpacing: "0.5px",
                color: "var(--muted, #64748B)",
                padding: "0.25rem 0.5rem",
              }}
            >
              FERRAMENTAS & RECURSOS
            </span>

            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.65rem",
                    padding: "0.75rem 0.85rem",
                    borderRadius: "10px",
                    border: isActive
                      ? "1.5px solid #5B34EA"
                      : "1px solid transparent",
                    background: isActive
                      ? "var(--surface, #FFFFFF)"
                      : "transparent",
                    color: isActive
                      ? "var(--brand-accent, #5B34EA)"
                      : "var(--ink, #0F172A)",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    boxShadow: isActive ? "0 2px 6px rgba(0,0,0,0.04)" : "none",
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "6px",
                      background: isActive
                        ? "rgba(91, 52, 234, 0.12)"
                        : "var(--line, #E2E8F0)",
                      color: isActive ? "#5B34EA" : "var(--muted, #64748B)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {tab.label}
                    </div>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "var(--muted, #64748B)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {tab.badge}
                    </div>
                  </div>
                  <ChevronRight size={14} opacity={isActive ? 1 : 0.4} />
                </button>
              );
            })}
          </nav>

          {/* Conteúdo da Aba Selecionada */}
          <div
            style={{
              padding: "1.75rem",
              overflowY: "auto",
              maxHeight: "calc(90vh - 85px)",
            }}
          >
            {/* 1. RADAR DE LEADS */}
            {activeTab === "radar" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span className="tag" style={{ background: "#EDE9FE", color: "#5B34EA" }}>
                      RADAR AO VIVO
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "#16A34A", fontWeight: 700 }}>
                      ● Rastreamento em Tempo Real
                    </span>
                  </div>
                  <h3 style={{ fontSize: "1.4rem", fontWeight: 800, margin: "0.4rem 0 0.25rem" }}>
                    Como Usar o Radar de Leads
                  </h3>
                  <p style={{ fontSize: "0.88rem", color: "var(--muted)", margin: 0 }}>
                    Monitore cada visitante no exato momento em que ele acessa sua página de vendas,
                    descubra onde ele parou na rolagem e recupere quem não comprou.
                  </p>
                </div>

                <div className="onboarding-guide-card" style={guideCardStyle}>
                  <div style={stepNumberStyle}>1</div>
                  <div>
                    <h4 style={stepTitleStyle}>Instale o Tracker na sua Landing Page</h4>
                    <p style={stepDescStyle}>
                      O pixel do Trackbase precisa estar presente na tag <code>&lt;head&gt;</code> da sua página.
                      Ele é ultra-leve (menos de 3KB) e não deixa seu site lento.
                    </p>
                    <div
                      style={{
                        background: "var(--surface-subtle, #F8FAFC)",
                        border: "1px solid var(--line, #E2E8F0)",
                        borderRadius: "8px",
                        padding: "8px 12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                        marginTop: "8px",
                      }}
                    >
                      <code style={{ fontSize: "0.75rem", wordBreak: "break-all" }}>
                        &lt;script src=&quot;https://seu-dominio.com/tracker.js&quot; data-key=&quot;SUA_CHAVE&quot;&gt;&lt;/script&gt;
                      </code>
                      <button
                        type="button"
                        className="button small"
                        onClick={() => {
                          navigator.clipboard.writeText('<script src="/tracker.js"></script>');
                          setCopiedScript(true);
                          setTimeout(() => setCopiedScript(false), 2000);
                        }}
                      >
                        {copiedScript ? <Check size={13} /> : <Copy size={13} />}
                        {copiedScript ? "Copiado!" : "Copiar"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="onboarding-guide-card" style={guideCardStyle}>
                  <div style={stepNumberStyle}>2</div>
                  <div>
                    <h4 style={stepTitleStyle}>Acesse a aba &quot;Radar de Leads&quot;</h4>
                    <p style={stepDescStyle}>
                      Cada pessoa que acessa sua página aparece instantaneamente na lista com:
                    </p>
                    <ul style={{ margin: "6px 0 0", paddingLeft: "20px", fontSize: "0.82rem", color: "var(--ink)" }}>
                      <li><strong>Localização Real:</strong> Cidade, estado e país do lead pelo IP.</li>
                      <li><strong>Dispositivo:</strong> Celular (iOS/Android) ou Computador (Desktop).</li>
                      <li><strong>Origem Exata:</strong> Anúncio do Facebook, Google ou direct.</li>
                    </ul>
                  </div>
                </div>

                <div className="onboarding-guide-card" style={guideCardStyle}>
                  <div style={stepNumberStyle}>3</div>
                  <div>
                    <h4 style={stepTitleStyle}>Abra o Simulador Visual de Rolagem (Heatmap)</h4>
                    <p style={stepDescStyle}>
                      Dê um clique em qualquer visitante na tabela. O Trackbase reproduz a página dele
                      mostrando exatamente até que dobra da página ele desceu:
                    </p>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: "8px",
                        marginTop: "10px",
                      }}
                    >
                      <div style={miniPillStyle}>
                        <span style={{ color: "#DC2626", fontWeight: 800 }}>0% a 25%</span>
                        <small>Saiu no topo da página</small>
                      </div>
                      <div style={miniPillStyle}>
                        <span style={{ color: "#D97706", fontWeight: 800 }}>50% a 75%</span>
                        <small>Assistiu ao meio da VSL</small>
                      </div>
                      <div style={miniPillStyle}>
                        <span style={{ color: "#16A34A", fontWeight: 800 }}>100% (Pitch)</span>
                        <small>Viu preço e botão de compra</small>
                      </div>
                    </div>
                  </div>
                </div>

                {onNavigateTab && (
                  <button
                    type="button"
                    className="button primary"
                    onClick={() => {
                      onClose();
                      onNavigateTab("radar");
                    }}
                    style={{ alignSelf: "flex-start" }}
                  >
                    <Radio size={16} /> Ir para o Radar de Leads agora
                  </button>
                )}
              </div>
            )}

            {/* 2. SHIELD ANTI-BLOQUEIO */}
            {activeTab === "shield" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span className="tag" style={{ background: "#FEE2E2", color: "#DC2626" }}>
                      ANTI-BLOQUEIO & ANTI-SPY
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "#16A34A", fontWeight: 700 }}>
                      ● Proteção com Domínio Próprio
                    </span>
                  </div>
                  <h3 style={{ fontSize: "1.4rem", fontWeight: 800, margin: "0.4rem 0 0.25rem" }}>
                    Como Usar o Shield Anti-Bloqueio
                  </h3>
                  <p style={{ fontSize: "0.88rem", color: "var(--muted)", margin: 0 }}>
                    Proteja sua página de vendas contra bloqueios do Facebook/Google e impeça que spy tools
                    (AdHeart) e concorrentes copiem suas ofertas.
                  </p>
                </div>

                <div className="onboarding-guide-card" style={guideCardStyle}>
                  <div style={stepNumberStyle}>1</div>
                  <div>
                    <h4 style={stepTitleStyle}>Entenda a Lógica do Cloaker Inteligente</h4>
                    <p style={stepDescStyle}>
                      O Shield analisa cada acesso antes de carregar a página:
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px" }}>
                      <div style={{ padding: "6px 10px", background: "rgba(37,99,235,0.06)", borderRadius: "6px", fontSize: "0.82rem" }}>
                        🔵 <strong>White Page (Página Neutra):</strong> Robôs e revisores da Meta/Google caem nesta página 100% aprovada pelas diretrizes.
                      </div>
                      <div style={{ padding: "6px 10px", background: "rgba(22,163,74,0.06)", borderRadius: "6px", fontSize: "0.82rem" }}>
                        🟢 <strong>Black Page (Página de Vendas):</strong> Compradores reais que clicaram no anúncio (`fbclid`) são direcionados para sua VSL.
                      </div>
                      <div style={{ padding: "6px 10px", background: "rgba(100,116,139,0.08)", borderRadius: "6px", fontSize: "0.82rem" }}>
                        ⚪ <strong>Gray Page (Isca):</strong> Spy tools (AdHeart) e concorrentes sem clique de anúncio caem em uma página genérica.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="onboarding-guide-card" style={guideCardStyle}>
                  <div style={stepNumberStyle}>2</div>
                  <div>
                    <h4 style={stepTitleStyle}>Como Apontar seu Domínio Próprio via CNAME</h4>
                    <p style={stepDescStyle}>
                      Para rodar o link no seu domínio sem tomar bloqueio de redirect:
                    </p>
                    <ol style={{ margin: "6px 0 0", paddingLeft: "20px", fontSize: "0.82rem", color: "var(--ink)", lineHeight: 1.5 }}>
                      <li>Acesse seu gerenciador DNS (Cloudflare, Registro.br, Hostinger, GoDaddy).</li>
                      <li>Crie um registro do tipo <strong>CNAME</strong>.</li>
                      <li><strong>Nome / Subdomínio:</strong> ex: <code>oferta</code> (para virar <code>oferta.seusite.com</code>).</li>
                      <li><strong>Destino:</strong> o endereço do seu servidor Trackbase.</li>
                      <li>Se usar Cloudflare, deixe como <strong>DNS Apenas (nuvem cinza)</strong>.</li>
                    </ol>
                  </div>
                </div>

                <div className="onboarding-guide-card" style={guideCardStyle}>
                  <div style={stepNumberStyle}>3</div>
                  <div>
                    <h4 style={stepTitleStyle}>Crie o Link no Shield</h4>
                    <p style={stepDescStyle}>
                      Na aba Shield, clique em <strong>Configurar Novo Domínio</strong>, cole a URL da sua
                      White Page e da sua Black Page e ative o escudo.
                    </p>
                  </div>
                </div>

                {onNavigateTab && (
                  <button
                    type="button"
                    className="button primary"
                    onClick={() => {
                      onClose();
                      onNavigateTab("shield");
                    }}
                    style={{ alignSelf: "flex-start" }}
                  >
                    <ShieldCheck size={16} /> Abrir aba do Shield
                  </button>
                )}
              </div>
            )}

            {/* 3. GERADOR DE LINKS UTM */}
            {activeTab === "utm" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span className="tag" style={{ background: "#E0F2FE", color: "#0369A1" }}>
                      GERADOR 1-CLIQUE
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "#0284C7", fontWeight: 700 }}>
                      ● Parâmetros Oficiais Meta & Google
                    </span>
                  </div>
                  <h3 style={{ fontSize: "1.4rem", fontWeight: 800, margin: "0.4rem 0 0.25rem" }}>
                    Como Criar e Usar Links com UTM
                  </h3>
                  <p style={{ fontSize: "0.88rem", color: "var(--muted)", margin: 0 }}>
                    Chega de preencher 12 campos técnicos. Escolha o canal em 1 clique e cole no anúncio.
                  </p>
                </div>

                <div className="onboarding-guide-card" style={guideCardStyle}>
                  <div style={stepNumberStyle}>1</div>
                  <div>
                    <h4 style={stepTitleStyle}>Selecione o Canal do Anúncio</h4>
                    <p style={stepDescStyle}>
                      No modal de criar link, basta clicar em:
                    </p>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "6px" }}>
                      <span className="chip">🔵 Meta Ads (Facebook/Insta)</span>
                      <span className="chip">🔴 Google Ads</span>
                      <span className="chip">⚫ TikTok Ads</span>
                      <span className="chip">🟢 WhatsApp</span>
                      <span className="chip">🟣 Instagram Bio</span>
                    </div>
                  </div>
                </div>

                <div className="onboarding-guide-card" style={guideCardStyle}>
                  <div style={stepNumberStyle}>2</div>
                  <div>
                    <h4 style={stepTitleStyle}>Como colar no Gerenciador de Anúncios da Meta</h4>
                    <p style={stepDescStyle}>
                      O Facebook separa o link em dois campos obrigatórios:
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
                      <div style={{ padding: "8px 12px", background: "var(--surface-subtle)", border: "1px solid var(--line)", borderRadius: "8px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                          <strong>1. Campo &quot;URL do site&quot;</strong>
                          <span style={{ color: "#0284C7" }}>Cole sua página limpa</span>
                        </div>
                        <code style={{ fontSize: "0.75rem" }}>https://seusite.com/produto</code>
                      </div>
                      <div style={{ padding: "8px 12px", background: "var(--surface-subtle)", border: "1px solid var(--line)", borderRadius: "8px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                          <strong>2. Campo &quot;Parâmetros de URL&quot;</strong>
                          <span style={{ color: "#0284C7" }}>Cole apenas as variáveis</span>
                        </div>
                        <code style={{ fontSize: "0.72rem" }}>utm_source=meta&utm_campaign=&#123;&#123;campaign.id&#125;&#125;...</code>
                      </div>
                    </div>
                  </div>
                </div>

                {onNavigateTab && (
                  <button
                    type="button"
                    className="button primary"
                    onClick={() => {
                      onClose();
                      onNavigateTab("links");
                    }}
                    style={{ alignSelf: "flex-start" }}
                  >
                    <Link2 size={16} /> Ver Meus Links UTM
                  </button>
                )}
              </div>
            )}

            {/* 4. GATEWAYS & WEBHOOKS */}
            {activeTab === "gateway" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span className="tag" style={{ background: "#DCFCE7", color: "#15803D" }}>
                      CHECKOUT & PAGAMENTOS
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "#16A34A", fontWeight: 700 }}>
                      ● Notificação de Vendas em Tempo Real
                    </span>
                  </div>
                  <h3 style={{ fontSize: "1.4rem", fontWeight: 800, margin: "0.4rem 0 0.25rem" }}>
                    Como Conectar Gateways de Pagamento
                  </h3>
                  <p style={{ fontSize: "0.88rem", color: "var(--muted)", margin: 0 }}>
                    Suporte nativo a Hotmart, Kiwify, Cakto, Kirvano, Eduzz, Monetizze, Wiapy e Lowfy.
                  </p>
                </div>

                <div className="onboarding-guide-card" style={guideCardStyle}>
                  <div style={stepNumberStyle}>1</div>
                  <div>
                    <h4 style={stepTitleStyle}>Conecte a plataforma no Trackbase</h4>
                    <p style={stepDescStyle}>
                      Na aba <strong>Integrações</strong>, escolha Hotmart, Kiwify ou Cakto e informe o Client ID e o
                      Client Secret gerados no painel da própria plataforma (menu de Credenciais de API). O
                      Trackbase gera a URL do webhook na hora — uma única URL vale pra todos os seus produtos:
                    </p>
                    <code style={{ display: "block", marginTop: "6px", fontSize: "0.75rem", padding: "6px 10px", background: "var(--surface-subtle)", borderRadius: "6px" }}>
                      https://seu-dominio.com/api/webhooks/kiwify/SEU_ID
                    </code>
                  </div>
                </div>

                <div className="onboarding-guide-card" style={guideCardStyle}>
                  <div style={stepNumberStyle}>2</div>
                  <div>
                    <h4 style={stepTitleStyle}>Cadastre o webhook no painel da plataforma</h4>
                    <p style={stepDescStyle}>
                      No painel da sua plataforma de pagamento (menu <em>Ferramentas &gt; Webhooks / Postback</em>),
                      adicione a URL copiada e marque os eventos de <strong>Compra Aprovada</strong>, <strong>Boleto Gerado</strong> e <strong>PIX</strong>.
                    </p>
                  </div>
                </div>

                <div className="onboarding-guide-card" style={guideCardStyle}>
                  <div style={stepNumberStyle}>3</div>
                  <div>
                    <h4 style={stepTitleStyle}>Seus produtos aparecem sozinhos</h4>
                    <p style={stepDescStyle}>
                      Não precisa cadastrar produto nenhum antes: assim que a primeira venda aprovada de um
                      produto chegar por essa conexão, o Trackbase cria a oferta correspondente automaticamente.
                    </p>
                  </div>
                </div>

                <div className="onboarding-guide-card" style={guideCardStyle}>
                  <div style={stepNumberStyle}>4</div>
                  <div>
                    <h4 style={stepTitleStyle}>Idempotência e Segurança Garantida</h4>
                    <p style={stepDescStyle}>
                      O Trackbase armazena uma chave única por transação. Mesmo que a Kiwify ou Hotmart envie
                      o webhook 3 vezes por instabilidade de rede, seu faturamento nunca será duplicado.
                    </p>
                  </div>
                </div>

                {onNavigateTab && (
                  <button
                    type="button"
                    className="button primary"
                    onClick={() => {
                      onClose();
                      onNavigateTab("integracoes");
                    }}
                    style={{ alignSelf: "flex-start" }}
                  >
                    <Plug size={16} /> Conectar Plataformas de Pagamento
                  </button>
                )}
              </div>
            )}

            {/* 5. API DE CONVERSÕES DA META (CAPI) */}
            {activeTab === "capi" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span className="tag" style={{ background: "#FEF3C7", color: "#B45309" }}>
                      SERVER-SIDE TRACKING
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "#16A34A", fontWeight: 700 }}>
                      ● 100% Automático
                    </span>
                  </div>
                  <h3 style={{ fontSize: "1.4rem", fontWeight: 800, margin: "0.4rem 0 0.25rem" }}>
                    Como Funciona a API de Conversões (CAPI)
                  </h3>
                  <p style={{ fontSize: "0.88rem", color: "var(--muted)", margin: 0 }}>
                    Envie compras aprovadas direto do servidor para o Facebook Ads, blindando sua conta
                    contra AdBlockers e restrições do iOS 14+.
                  </p>
                </div>

                <div className="onboarding-guide-card" style={guideCardStyle}>
                  <div style={stepNumberStyle}>1</div>
                  <div>
                    <h4 style={stepTitleStyle}>Você não precisa configurar código</h4>
                    <p style={stepDescStyle}>
                      Ao conectar o pixel da Meta e autorizar via OAuth na aba Integrações, o Trackbase
                      já assume o envio dos eventos de conversão no servidor automaticamente.
                    </p>
                  </div>
                </div>

                <div className="onboarding-guide-card" style={guideCardStyle}>
                  <div style={stepNumberStyle}>2</div>
                  <div>
                    <h4 style={stepTitleStyle}>Criptografia SHA-256 e Event Quality Match</h4>
                    <p style={stepDescStyle}>
                      Quando a venda é confirmada pelo webhook, os dados pessoais (e-mail, telefone)
                      são hasheados em SHA-256 e enviados com os identificadores <code>fbp</code>, <code>fbc</code>,
                      IP e User-Agent brutos coletados pelo Tracker. Isso garante pontuação máxima (8 a 10)
                      na qualidade do evento no Gerenciador de Eventos da Meta.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 6. ALERTAS E NOTIFICAÇÕES */}
            {activeTab === "alertas" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span className="tag" style={{ background: "#F3E8FF", color: "#7E22CE" }}>
                      NOTIFICAÇÕES PUSH & SOM
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "#7E22CE", fontWeight: 700 }}>
                      ● Efeito Caixa Registradora
                    </span>
                  </div>
                  <h3 style={{ fontSize: "1.4rem", fontWeight: 800, margin: "0.4rem 0 0.25rem" }}>
                    Como Configurar Alertas e Som de Venda
                  </h3>
                  <p style={{ fontSize: "0.88rem", color: "var(--muted)", margin: 0 }}>
                    Receba o aviso instantâneo a cada venda aprovada no computador e no celular.
                  </p>
                </div>

                <div className="onboarding-guide-card" style={guideCardStyle}>
                  <div style={stepNumberStyle}>1</div>
                  <div>
                    <h4 style={stepTitleStyle}>Alerta Sonoro no Painel</h4>
                    <p style={stepDescStyle}>
                      Deixe a aba do Trackbase aberta. Toda vez que uma compra for aprovada pelo webhook,
                      o Web Audio API reproduz o som clássico de venda. Você pode testar o som agora mesmo
                      na aba Alertas no botão <strong>Testar Alerta Sonoro</strong>.
                    </p>
                  </div>
                </div>

                <div className="onboarding-guide-card" style={guideCardStyle}>
                  <div style={stepNumberStyle}>2</div>
                  <div>
                    <h4 style={stepTitleStyle}>Notificações Push no Celular e Navegador</h4>
                    <p style={stepDescStyle}>
                      Na aba Alertas, ative as notificações Push. Você pode personalizar o título e a mensagem
                      usando tags como <code>&#123;valor&#125;</code>, <code>&#123;produto&#125;</code> e <code>&#123;comprador&#125;</code>.
                    </p>
                  </div>
                </div>

                {onNavigateTab && (
                  <button
                    type="button"
                    className="button primary"
                    onClick={() => {
                      onClose();
                      onNavigateTab("alertas");
                    }}
                    style={{ alignSelf: "flex-start" }}
                  >
                    <Volume2 size={16} /> Abrir Central de Alertas
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const guideCardStyle: React.CSSProperties = {
  display: "flex",
  gap: "1rem",
  padding: "1rem 1.15rem",
  background: "var(--surface, #FFFFFF)",
  border: "1px solid var(--line, #E2E8F0)",
  borderRadius: "12px",
  alignItems: "flex-start",
};

const stepNumberStyle: React.CSSProperties = {
  width: "28px",
  height: "28px",
  borderRadius: "50%",
  background: "var(--brand-accent, #5B34EA)",
  color: "#FFFFFF",
  fontSize: "0.85rem",
  fontWeight: 800,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const stepTitleStyle: React.CSSProperties = {
  fontSize: "0.95rem",
  fontWeight: 700,
  margin: "0 0 0.35rem",
  color: "var(--ink, #0F172A)",
};

const stepDescStyle: React.CSSProperties = {
  fontSize: "0.82rem",
  color: "var(--muted, #64748B)",
  lineHeight: 1.45,
  margin: 0,
};

const miniPillStyle: React.CSSProperties = {
  padding: "8px",
  background: "var(--surface-subtle, #F8FAFC)",
  border: "1px solid var(--line, #E2E8F0)",
  borderRadius: "8px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  fontSize: "0.75rem",
  textAlign: "center",
};
