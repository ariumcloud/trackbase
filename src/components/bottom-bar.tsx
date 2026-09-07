"use client";

import React from "react";
import {
  LayoutDashboard,
  Layers,
  Link2,
  BarChart3,
  Copy,
  Activity,
  Bot,
  Plug,
  Bell,
  Menu,
} from "lucide-react";

interface BottomBarProps {
  currentTab: string;
  onSelectTab: (tabId: string) => void;
  onOpenMenu: () => void;
  unreadAlertsCount?: number;
}

export function BottomBar({
  currentTab,
  onSelectTab,
  onOpenMenu,
  unreadAlertsCount = 0,
}: BottomBarProps) {
  const items = [
    { id: "visao", label: "Início", icon: LayoutDashboard },
    { id: "ofertas", label: "Ofertas", icon: Layers },
    { id: "links", label: "Links", icon: Link2 },
    { id: "campanhas", label: "Campanhas", icon: BarChart3 },
    { id: "clonador", label: "Clonador", icon: Copy },
    { id: "diagnostico", label: "Diagnóstico", icon: Activity },
    { id: "integracoes", label: "Integrações", icon: Plug },
    { id: "assistente", label: "Assistente IA", icon: Bot },
    {
      id: "alertas",
      label: "Alertas",
      icon: Bell,
      badge: unreadAlertsCount > 0 ? unreadAlertsCount : undefined,
    },
  ];

  return (
    <nav className="mobile-bottom-bar" aria-label="Navegação mobile rápida">
      <div className="bottom-bar-scroller">
        {items.map((item) => {
          const Icon = item.icon;
          const active = currentTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`bottom-bar-item ${active ? "active" : ""}`}
            >
              <div className="bottom-bar-icon-wrap">
                <Icon size={19} strokeWidth={active ? 2.4 : 1.8} />
                {item.badge ? (
                  <span className="bottom-bar-badge">{item.badge}</span>
                ) : null}
              </div>
              <span className="bottom-bar-label">{item.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={onOpenMenu}
          className="bottom-bar-item bottom-bar-menu-btn"
          aria-label="Mais opções e configurações"
        >
          <div className="bottom-bar-icon-wrap">
            <Menu size={19} strokeWidth={1.8} />
          </div>
          <span className="bottom-bar-label">Menu</span>
        </button>
      </div>
    </nav>
  );
}
