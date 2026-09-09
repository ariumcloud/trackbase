"use client";

import { useState, useTransition } from "react";
import { createMcpApiKeyAction, revokeMcpApiKeyAction } from "@/app/actions";

export type ApiKeyItem = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export function McpSettingsView({
  workspace,
  initialKeys = [],
  appUrl = "https://trackbase.com.br",
}: {
  workspace: string;
  initialKeys?: ApiKeyItem[];
  appUrl?: string;
}) {
  const [keys, setKeys] = useState<ApiKeyItem[]>(initialKeys);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [keyName, setKeyName] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"claude" | "cursor" | "cli">("claude");
  const [loading, startTransition] = useTransition();

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2500);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createMcpApiKeyAction(workspace, keyName || "Claude / Codex MCP");
      if (res.ok && res.rawKey && res.keyInfo) {
        setNewKey(res.rawKey);
        setKeyName("");
        const info = res.keyInfo as ApiKeyItem;
        setKeys((prev) => [info, ...prev]);
      }
    });
  };

  const handleRevoke = (id: string) => {
    if (!confirm("Tem certeza que deseja revogar esta chave de API? A IA perderá o acesso.")) return;
    startTransition(async () => {
      const res = await revokeMcpApiKeyAction(workspace, id);
      if (res.ok) {
        setKeys((prev) => prev.filter((k) => k.id !== id));
      }
    });
  };

  const displayKey = newKey || (keys[0] ? `${keys[0].prefix}` : "tb_live_SUA_CHAVE_AQUI");

  const claudeConfig = JSON.stringify(
    {
      mcpServers: {
        trackbase: {
          command: "node",
          args: ["./bin/trackbase-mcp.mjs"],
          env: {
            TRACKBASE_API_KEY: displayKey,
            TRACKBASE_API_URL: appUrl,
          },
        },
      },
    },
    null,
    2,
  );

  const cursorConfig = JSON.stringify(
    {
      mcpServers: {
        trackbase: {
          command: "node",
          args: ["./bin/trackbase-mcp.mjs"],
          env: {
            TRACKBASE_API_KEY: displayKey,
            TRACKBASE_API_URL: appUrl,
          },
        },
      },
    },
    null,
    2,
  );

  return (
    <div style={{ display: "grid", gap: "1.5rem", maxWidth: "900px", margin: "0 auto", padding: "1rem 0" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)", borderRadius: "14px", padding: "1.5rem 1.75rem", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <span style={{ fontSize: "1.5rem" }}>⚡</span>
          <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700 }}>Conexão MCP · Claude, Codex & Cursor</h2>
        </div>
        <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5, opacity: 0.9 }}>
          Conecte o seu assistente de IA diretamente ao Trackbase através do <b>Model Context Protocol (MCP)</b>.
          Permita que o Claude Desktop, Claude Code ou Codex/Cursor consultem métricas de vendas, analisem campanhas do Meta e criem links de rastreio em tempo real.
        </p>
      </div>

      {/* Alerta de chave recém-gerada */}
      {newKey && (
        <div style={{ background: "#FEF3C7", border: "1px solid #F59E0B", borderRadius: "12px", padding: "1.25rem", color: "#92400E" }}>
          <strong style={{ display: "block", fontSize: "0.95rem", marginBottom: "0.35rem" }}>
            🔑 Chave MCP gerada com sucesso!
          </strong>
          <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.85rem" }}>
            Por segurança, esta chave só será exibida <b>uma única vez</b>. Copie e guarde-a agora:
          </p>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input
              readOnly
              value={newKey}
              style={{
                flex: 1,
                padding: "0.6rem 0.85rem",
                fontFamily: "monospace",
                fontSize: "0.85rem",
                background: "#fff",
                border: "1px solid #D97706",
                borderRadius: "8px",
              }}
            />
            <button
              type="button"
              className="button primary"
              onClick={() => handleCopy(newKey, "new-key")}
              style={{ padding: "0.6rem 1.1rem" }}
            >
              {copied === "new-key" ? "✓ Copiado!" : "Copiar Chave"}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => setNewKey(null)}
              style={{ padding: "0.6rem 0.85rem" }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Formulário de criação de chave */}
      <div style={{ background: "var(--surface, #fff)", border: "1px solid var(--line, #E2E8F0)", borderRadius: "12px", padding: "1.25rem" }}>
        <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.05rem", fontWeight: 700 }}>Gerar Chave de Acesso MCP</h3>
        <p style={{ margin: "0 0 1rem 0", color: "var(--muted, #64748B)", fontSize: "0.85rem" }}>
          Crie uma chave de API para autenticar o Claude Desktop, Codex ou Cursor com seu workspace.
        </p>
        <form onSubmit={handleCreate} style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Nome da chave (ex.: Claude Desktop Mac, Cursor Trabalho)"
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            disabled={loading}
            style={{ flex: "1 1 250px", padding: "0.6rem 0.85rem", borderRadius: "8px", border: "1px solid var(--line, #CBD5E1)" }}
          />
          <button className="button primary" disabled={loading} style={{ padding: "0.6rem 1.25rem" }}>
            {loading ? "Gerando…" : "+ Criar Chave MCP"}
          </button>
        </form>

        {/* Lista de Chaves Ativas */}
        {keys.length > 0 && (
          <div style={{ marginTop: "1.5rem" }}>
            <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "0.9rem", color: "var(--muted, #64748B)" }}>
              Chaves ativas ({keys.length})
            </h4>
            <div style={{ display: "grid", gap: "0.5rem" }}>
              {keys.map((k) => (
                <div
                  key={k.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.75rem 1rem",
                    border: "1px solid var(--line, #E2E8F0)",
                    borderRadius: "8px",
                    background: "var(--surface-subtle, #F8FAFC)",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "0.85rem", color: "var(--ink, #0F172A)" }}>{k.name}</strong>
                    <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.75rem", color: "var(--muted, #64748B)", marginTop: "2px" }}>
                      <code>{k.prefix}</code>
                      <span>Criada em: {new Date(k.createdAt).toLocaleDateString("pt-BR")}</span>
                      {k.lastUsedAt && <span>Último uso: {new Date(k.lastUsedAt).toLocaleDateString("pt-BR")}</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevoke(k.id)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#DC2626",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      padding: "4px 8px",
                    }}
                  >
                    Revogar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Como configurar no Claude / Codex / Cursor */}
      <div style={{ background: "var(--surface, #fff)", border: "1px solid var(--line, #E2E8F0)", borderRadius: "12px", padding: "1.25rem" }}>
        <h3 style={{ margin: "0 0 0.75rem 0", fontSize: "1.05rem", fontWeight: 700 }}>Como Configurar no seu Aplicativo</h3>
        
        {/* Abas */}
        <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--line, #E2E8F0)", paddingBottom: "0.75rem", marginBottom: "1rem" }}>
          <button
            type="button"
            className={`button ${activeTab === "claude" ? "primary" : "secondary"}`}
            onClick={() => setActiveTab("claude")}
            style={{ fontSize: "0.82rem", padding: "0.4rem 0.85rem" }}
          >
            Claude Desktop
          </button>
          <button
            type="button"
            className={`button ${activeTab === "cursor" ? "primary" : "secondary"}`}
            onClick={() => setActiveTab("cursor")}
            style={{ fontSize: "0.82rem", padding: "0.4rem 0.85rem" }}
          >
            Codex / Cursor
          </button>
          <button
            type="button"
            className={`button ${activeTab === "cli" ? "primary" : "secondary"}`}
            onClick={() => setActiveTab("cli")}
            style={{ fontSize: "0.82rem", padding: "0.4rem 0.85rem" }}
          >
            Claude Code / Terminal
          </button>
        </div>

        {activeTab === "claude" && (
          <div>
            <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.85rem", color: "var(--muted, #64748B)" }}>
              1. Abra o arquivo de configuração do Claude Desktop:
              <br />
              • <b>Windows:</b> <code>%APPDATA%\Claude\claude_desktop_config.json</code>
              <br />
              • <b>Mac:</b> <code>~/Library/Application Support/Claude/claude_desktop_config.json</code>
            </p>
            <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.85rem", color: "var(--muted, #64748B)" }}>
              2. Cole a configuração abaixo e reinicie o Claude Desktop:
            </p>
            <div style={{ position: "relative" }}>
              <pre
                style={{
                  background: "#0F172A",
                  color: "#E2E8F0",
                  padding: "1rem",
                  borderRadius: "8px",
                  fontSize: "0.82rem",
                  overflowX: "auto",
                  margin: "0 0 0.5rem 0",
                }}
              >
                {claudeConfig}
              </pre>
              <button
                type="button"
                className="button primary"
                onClick={() => handleCopy(claudeConfig, "claude-json")}
                style={{ position: "absolute", top: "10px", right: "10px", fontSize: "0.75rem", padding: "4px 10px" }}
              >
                {copied === "claude-json" ? "✓ Copiado" : "Copiar JSON"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "cursor" && (
          <div>
            <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.85rem", color: "var(--muted, #64748B)" }}>
              No Cursor ou Codex, crie ou edite o arquivo <code>.cursor/mcp.json</code> na raiz do seu projeto:
            </p>
            <div style={{ position: "relative" }}>
              <pre
                style={{
                  background: "#0F172A",
                  color: "#E2E8F0",
                  padding: "1rem",
                  borderRadius: "8px",
                  fontSize: "0.82rem",
                  overflowX: "auto",
                  margin: "0 0 0.5rem 0",
                }}
              >
                {cursorConfig}
              </pre>
              <button
                type="button"
                className="button primary"
                onClick={() => handleCopy(cursorConfig, "cursor-json")}
                style={{ position: "absolute", top: "10px", right: "10px", fontSize: "0.75rem", padding: "4px 10px" }}
              >
                {copied === "cursor-json" ? "✓ Copiado" : "Copiar JSON"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "cli" && (
          <div>
            <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.85rem", color: "var(--muted, #64748B)" }}>
              Para conectar no <b>Claude Code</b> via terminal, execute o comando:
            </p>
            <div style={{ position: "relative" }}>
              <pre
                style={{
                  background: "#0F172A",
                  color: "#E2E8F0",
                  padding: "1rem",
                  borderRadius: "8px",
                  fontSize: "0.82rem",
                  overflowX: "auto",
                  margin: "0 0 0.5rem 0",
                }}
              >
                {`claude mcp add trackbase -- node bin/trackbase-mcp.mjs`}
              </pre>
              <button
                type="button"
                className="button primary"
                onClick={() => handleCopy(`claude mcp add trackbase -- node bin/trackbase-mcp.mjs`, "cli-cmd")}
                style={{ position: "absolute", top: "10px", right: "10px", fontSize: "0.75rem", padding: "4px 10px" }}
              >
                {copied === "cli-cmd" ? "✓ Copiado" : "Copiar Comando"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Ferramentas Disponíveis */}
      <div style={{ background: "var(--surface, #fff)", border: "1px solid var(--line, #E2E8F0)", borderRadius: "12px", padding: "1.25rem" }}>
        <h3 style={{ margin: "0 0 0.75rem 0", fontSize: "1.05rem", fontWeight: 700 }}>
          Ferramentas que sua IA ganha com o Trackbase
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.75rem" }}>
          {[
            { name: "get_metrics", desc: "Consulta faturamento bruto/líquido, vendas aprovadas, ticket médio, taxa de reembolso e ROAS real por período." },
            { name: "list_campaigns", desc: "Lista todas as campanhas ativas do Meta Ads e Google Ads com gastos, cliques e receita gerada." },
            { name: "list_offers", desc: "Acessa ofertas, checkouts vinculados e páginas de vendas cadastradas no workspace." },
            { name: "create_tracking_link", desc: "Cria links de rastreio com UTMs completas (origem, campanha, criativo) e link encurtado." },
            { name: "get_recent_sales", desc: "Consulta as vendas mais recentes em tempo real de qualquer checkout (Hotmart, Kiwify, Cakto, etc.)." },
            { name: "get_mined_offers", desc: "Espiona anúncios minerados de concorrentes com dias ativos, títulos e criativos." },
          ].map((tool) => (
            <div key={tool.name} style={{ border: "1px solid var(--line, #E2E8F0)", borderRadius: "8px", padding: "0.75rem", background: "var(--surface-subtle, #F8FAFC)" }}>
              <code style={{ color: "var(--brand-primary, #6366F1)", fontWeight: 700, fontSize: "0.82rem" }}>{tool.name}</code>
              <p style={{ margin: "4px 0 0 0", fontSize: "0.78rem", color: "var(--muted, #64748B)", lineHeight: 1.45 }}>{tool.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
