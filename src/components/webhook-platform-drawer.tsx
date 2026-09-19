"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, X, ArrowLeft, Copy, Check, ExternalLink, Webhook } from "lucide-react";

export type PlatformItem = {
  id: string;
  name: string;
  native: boolean;
};

export const ALL_GATEWAY_PLATFORMS: PlatformItem[] = [
  { id: "hotmart", name: "Hotmart", native: true },
  { id: "kiwify", name: "Kiwify", native: true },
  { id: "cartpanda", name: "Cartpanda", native: true },
  { id: "vega1", name: "Vega 1", native: false },
  { id: "kirvano", name: "Kirvano", native: true },
  { id: "shopify", name: "Shopify", native: true },
  { id: "perfectpay", name: "PerfectPay", native: true },
  { id: "yampi", name: "Yampi", native: true },
  { id: "lastlink", name: "Lastlink", native: false },
  { id: "stripe", name: "Stripe", native: true },
  { id: "payt", name: "Payt", native: false },
  { id: "logzz", name: "Logzz", native: false },
  { id: "adoorei", name: "Adoorei", native: false },
  { id: "tribopay", name: "TriboPay", native: false },
  { id: "paradise", name: "Paradise", native: false },
  { id: "clickbank", name: "Clickbank", native: false },
  { id: "ticto", name: "Ticto", native: true },
  { id: "eduzz", name: "Eduzz", native: true },
  { id: "braip", name: "Braip", native: false },
  { id: "pepper", name: "Pepper", native: false },
  { id: "woocommerce", name: "Woocommerce", native: false },
  { id: "buygoods", name: "BuyGoods", native: false },
  { id: "mundpay", name: "MundPay", native: false },
  { id: "disrupty", name: "Disrupty", native: false },
  { id: "greenn", name: "Greenn", native: true },
  { id: "monetizze", name: "Monetizze", native: true },
  { id: "guru", name: "Guru", native: false },
  { id: "digistore", name: "Digistore", native: false },
  { id: "hubla", name: "Hubla", native: false },
  { id: "doppus", name: "Doppus", native: false },
  { id: "frendz", name: "Frendz", native: false },
  { id: "invictuspay", name: "InvictusPay", native: false },
  { id: "appmax", name: "Appmax", native: false },
  { id: "nitropagamentos", name: "NitroPagamentos", native: false },
  { id: "goatpay", name: "GoatPay", native: false },
  { id: "hebreus", name: "Hebreus", native: false },
  { id: "iexperience", name: "IExperience", native: false },
  { id: "pagtrust", name: "PagTrust", native: false },
  { id: "nuvemshop", name: "NuvemShop", native: false },
  { id: "fortpay", name: "FortPay", native: false },
  { id: "systeme", name: "Systeme", native: false },
  { id: "ironpay", name: "IronPay", native: false },
  { id: "cinqpay", name: "CinqPay", native: false },
  { id: "sharkpays", name: "SharkPays", native: false },
  { id: "maxweb", name: "Maxweb", native: false },
  { id: "zouti", name: "Zouti", native: false },
  { id: "pantherfy", name: "Pantherfy", native: false },
  { id: "strivpay", name: "StrivPay", native: false },
  { id: "atomopay", name: "AtomoPay", native: false },
  { id: "allpay", name: "AllPay", native: false },
  { id: "bullpay", name: "BullPay", native: false },
  { id: "octuspay", name: "OctusPay", native: false },
  { id: "zippify", name: "Zippify", native: false },
  { id: "masterfy", name: "Masterfy", native: false },
  { id: "inovapag", name: "InovaPag", native: false },
  { id: "soutpay", name: "SoutPay", native: false },
  { id: "cakto", name: "Cakto", native: true },
  { id: "wiapy", name: "Wiapy", native: true },
  { id: "lowfy", name: "Lowfy", native: true },
];

interface WebhookPlatformDrawerProps {
  open: boolean;
  onClose: () => void;
  onSelectPlatform: (platformId: string) => void;
  workspace: string;
  appUrl?: string;
}

export function WebhookPlatformDrawer({
  open,
  onClose,
  onSelectPlatform,
  workspace,
  appUrl = "https://trackbase.com.br",
}: WebhookPlatformDrawerProps) {
  const [search, setSearch] = useState("");
  const [selectedNonNative, setSelectedNonNative] = useState<PlatformItem | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setSelectedNonNative(null);
      setCopied(false);
    }
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        if (selectedNonNative) {
          setSelectedNonNative(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, selectedNonNative, onClose]);

  const filteredPlatforms = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ALL_GATEWAY_PLATFORMS;
    return ALL_GATEWAY_PLATFORMS.filter((p) =>
      p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
    );
  }, [search]);

  if (!open) return null;

  const genericWebhookUrl = `${appUrl.replace(/\/$/, "")}/api/webhooks/generic/${workspace}`;

  return (
    <div className="webhook-drawer-backdrop" onClick={onClose}>
      <aside
        className="webhook-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Webhooks e Gateways"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="webhook-drawer-header">
          <div className="webhook-drawer-header-info">
            {selectedNonNative && (
              <button
                type="button"
                className="webhook-drawer-back-btn"
                onClick={() => setSelectedNonNative(null)}
                title="Voltar às plataformas"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div>
              <h2 className="webhook-drawer-title">
                {selectedNonNative ? selectedNonNative.name : "Webhooks"}
              </h2>
              <p className="webhook-drawer-subtitle">
                {selectedNonNative
                  ? "Configuração de webhook para esta plataforma"
                  : "Selecione uma plataforma para começar:"}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="webhook-drawer-close-btn"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        {!selectedNonNative ? (
          <>
            {/* Search Input */}
            <div className="webhook-drawer-search-wrap">
              <Search className="webhook-drawer-search-icon" size={16} />
              <input
                type="text"
                className="webhook-drawer-search-input"
                placeholder="Buscar por plataforma"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
              {search && (
                <button
                  type="button"
                  className="webhook-drawer-search-clear"
                  onClick={() => setSearch("")}
                  title="Limpar busca"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Platform Grid */}
            <div className="webhook-drawer-body">
              {filteredPlatforms.length > 0 ? (
                <div className="webhook-drawer-grid">
                  {filteredPlatforms.map((platform) => (
                    <button
                      key={platform.id}
                      type="button"
                      className={`webhook-platform-btn${platform.native ? " is-native" : ""}`}
                      onClick={() => {
                        if (platform.native) {
                          onClose();
                          onSelectPlatform(platform.id);
                        } else {
                          setSelectedNonNative(platform);
                        }
                      }}
                    >
                      <span>{platform.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="webhook-drawer-empty">
                  <p>Nenhuma plataforma encontrada com &ldquo;{search}&rdquo;.</p>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setSearch("")}
                  >
                    Ver todas as plataformas
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Non-native platform instruction view */
          <div className="webhook-drawer-body webhook-drawer-detail">
            <div className="webhook-detail-card">
              <div className="webhook-detail-badge">
                <Webhook size={18} />
                <span>Integração por Webhook</span>
              </div>
              <h3>Conectando {selectedNonNative.name} à Trackbase</h3>
              <p>
                A Trackbase aceita notificações de venda, reembolso e status de qualquer checkout e gateway via webhook seguro.
              </p>

              <div className="webhook-detail-step">
                <span className="step-number">1</span>
                <div>
                  <strong>URL do Webhook do seu Workspace</strong>
                  <p>Cadastre esta URL nas configurações de Webhooks / Notificações da {selectedNonNative.name}:</p>
                  <div className="webhook-url-box">
                    <code>{genericWebhookUrl}</code>
                    <button
                      type="button"
                      className="button small"
                      onClick={() => {
                        navigator.clipboard.writeText(genericWebhookUrl);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? "Copiado!" : "Copiar"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="webhook-detail-step">
                <span className="step-number">2</span>
                <div>
                  <strong>Eventos Recomendados</strong>
                  <p>
                    Selecione os eventos de <em>Compra Aprovada</em>, <em>Reembolso</em> e <em>Cancelamento</em>. A Trackbase normalizará os valores e dados de rastreio automaticamente.
                  </p>
                </div>
              </div>

              <div className="webhook-detail-step">
                <span className="step-number">3</span>
                <div>
                  <strong>Precisa de suporte dedicado ou adaptador nativo?</strong>
                  <p>
                    Nossa equipe homologa e adiciona campos específicos em tempo recorde. Fale conosco pelo suporte se desejar validação antecipada com nossa equipe.
                  </p>
                </div>
              </div>

              <div className="webhook-detail-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setSelectedNonNative(null)}
                >
                  <ArrowLeft size={15} /> Escolher outra plataforma
                </button>
                <a
                  href="https://api.whatsapp.com/send?phone=5511999999999&text=Ol%C3%A1,%20gostaria%20de%20ajuda%20para%20conectar%20a%20plataforma%20"
                  target="_blank"
                  rel="noreferrer"
                  className="button"
                >
                  Suporte <ExternalLink size={14} />
                </a>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
