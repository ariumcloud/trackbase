"use client";

import React from "react";
import {
  LayoutDashboard,
  Layers,
  Link2,
  Copy,
  Activity,
  Bot,
} from "lucide-react";

interface BottomBarProps {
  currentTab: string;
  onSelectTab: (tabId: string) => void;
}

export function BottomBar({ currentTab, onSelectTab }: BottomBarProps) {
  const items = [
    { id: "visao", label: "Início", icon: LayoutDashboard },
    { id: "ofertas", label: "Ofertas", icon: Layers },
    { id: "links", label: "Links", icon: Link2 },
    { id: "clonador", label: "Clonador", icon: Copy },
    { id: "diagnostico", label: "Diagnóstico", icon: Activity },
    { id: "assistente", label: "Assistente", icon: Bot },
  ];

  return (
    <nav
      className="mobile-bottom-bar"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "60px",
        background: "#FFFFFF",
        borderTop: "1px solid var(--line, #E2E8F0)",
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        zIndex: 90,
        boxShadow: "0 -2px 10px rgba(0,0,0,0.05)",
        padding: "0 0.25rem",
      }}
      aria-label="Navegação mobile inferior"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = currentTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectTab(item.id)}
            style={{
              background: "none",
              border: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "0.35rem 0.5rem",
              color: active ? "#5B34EA" : "var(--muted, #64748B)",
              cursor: "pointer",
              flex: 1,
              transition: "color 0.15s ease",
            }}
          >
            <Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
            <span
              style={{
                fontSize: "0.68rem",
                marginTop: "2px",
                fontWeight: active ? 600 : 400,
              }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
