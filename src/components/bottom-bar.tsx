"use client";

import React from "react";
import {
  LayoutDashboard,
  Layers,
  Link2,
  Plug,
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
  // 4 abas mais frequentes + botão Menu para abrir o drawer com tudo
  const items = [
    { id: "visao", label: "Início", icon: LayoutDashboard },
    { id: "ofertas", label: "Ofertas", icon: Layers },
    { id: "links", label: "Links", icon: Link2 },
    { id: "integracoes", label: "Integrações", icon: Plug },
  ];

  return (
    <nav className="mobile-bottom-bar" aria-label="Navegação inferior mobile">
      <div className="bottom-bar-fixed-grid">
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
                <Icon size={20} strokeWidth={active ? 2.5 : 1.9} />
              </div>
              <span className="bottom-bar-label">{item.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={onOpenMenu}
          className="bottom-bar-item bottom-bar-menu-trigger"
          aria-label="Abrir todas as ferramentas e configurações"
        >
          <div className="bottom-bar-icon-wrap">
            <Menu size={20} strokeWidth={1.9} />
            {unreadAlertsCount > 0 ? (
              <span className="bottom-bar-badge">{unreadAlertsCount}</span>
            ) : null}
          </div>
          <span className="bottom-bar-label">Menu</span>
        </button>
      </div>
    </nav>
  );
}
