"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Key,
  Copy,
  Check,
  Trash2,
  Terminal,
  Cpu,
  Sparkles,
  Code2,
  Layers,
} from "lucide-react";
import {
  createMcpApiKeyAction,
  listMcpApiKeysAction,
  revokeMcpApiKeyAction,
} from "@/app/actions";

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
  const [message, setMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"claude" | "cursor" | "codex" | "cli">("claude");
  const [loading, startTransition] = useTransition();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);

  useEffect(() => {
    let mounted = true;
    listMcpApiKeysAction(workspace).then((res) => {
      if (!mounted) return;
      if (res.error) setMessage(res.error);
      else setKeys(res.keys || []);
    });
    return () => {
      mounted = false;
    };
  }, [workspace]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2500);
  };

  const handleCopyConfig = (text: string, id: string) => {
    if (!newKey) {
      setMessage("Gere uma chave nova acima para liberar uma configuração válida. A chave completa não pode ser recuperada depois.");
      return;
    }
    handleCopy(text, id);
  };

  const handleTestConnection = async () => {
    if (!newKey) {
      setMessage("Gere uma chave nova acima para testar a conexão.");
      return;
    }

    setTesting(true);
    setTestResult(null);
    setMessage(null);
    try {
      const response = await fetch("/api/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${newKey}`,
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
      });
      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok || payload.error) {
        throw new Error(payload.error?.message || "O servidor recusou a conexão.");
      }
      setTestResult("success");
    } catch (error) {
      setTestResult("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível testar a conexão.");
    } finally {
      setTesting(false);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await createMcpApiKeyAction(
        workspace,
        keyName.trim() || "Claude Desktop MCP",
      );
      if (res.ok && res.rawKey && res.keyInfo) {
        setNewKey(res.rawKey);
        setKeyName("");
        const info = res.keyInfo as ApiKeyItem;
        setKeys((prev) => [info, ...prev]);
      } else {
        setMessage(res.error || "Não foi possível gerar a chave MCP.");
      }
    });
  };

  const handleRevoke = (id: string) => {
    if (
      !confirm(
        "Tem certeza que deseja revogar esta chave de API? A IA perderá o acesso a este workspace.",
      )
    )
      return;
    startTransition(async () => {
      const res = await revokeMcpApiKeyAction(workspace, id);
      if (res.ok) {
        setKeys((prev) => prev.filter((k) => k.id !== id));
      } else {
        setMessage(res.error || "Não foi possível revogar esta chave.");
      }
    });
  };

  // A prefix is only a visual identifier. It can never be used to authenticate.
  const activeApiKey = newKey || "COLE_A_CHAVE_MCP_GERADA_AQUI";

  const claudeConfig = JSON.stringify(
    {
      mcpServers: {
        trackbase: {
          command: "node",
          args: ["./bin/trackbase-mcp.mjs"],
          env: {
            TRACKBASE_API_KEY: activeApiKey,
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
            TRACKBASE_API_KEY: activeApiKey,
            TRACKBASE_API_URL: appUrl,
          },
        },
      },
    },
    null,
    2,
  );

  const cliCommand = `claude mcp add trackbase -- node bin/trackbase-mcp.mjs`;

  const codexConfig = `[mcp_servers.trackbase]
url = "${appUrl.replace(/\/$/, "")}/api/mcp"
bearer_token_env_var = "TRACKBASE_API_KEY"`;

  const codexEnvCommand = newKey
    ? `setx TRACKBASE_API_KEY "${newKey}"`
    : `setx TRACKBASE_API_KEY "COLE_A_CHAVE_MCP_GERADA_AQUI"`;

  return (
    <div
      className="mcp-settings-view"
      style={{
        display: "grid",
        gap: "1.5rem",
        maxWidth: "960px",
        margin: "0 auto",
        paddingBottom: "3rem",
      }}
    >
      {/* Alerta de chave recém-criada */}
      {newKey && (
        <div
          style={{
            background: "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)",
            border: "1.5px solid #F59E0B",
            borderRadius: "14px",
            padding: "1.25rem 1.5rem",
            boxShadow: "0 6px 20px rgba(245, 158, 11, 0.12)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.4rem",
              color: "#92400E",
            }}
          >
            <Key size={18} />
            <strong style={{ fontSize: "1rem" }}>Chave de Acesso MCP Gerada!</strong>
          </div>
          <p
            style={{
              margin: "0 0 0.85rem 0",
              fontSize: "0.86rem",
              color: "#78350F",
              lineHeight: 1.45,
            }}
          >
            Esta chave completa só é exibida <strong>uma única vez</strong>. Copie e
            guarde em local seguro ou cole diretamente no Claude Desktop agora:
          </p>
          <div
            style={{
              display: "flex",
              gap: "0.6rem",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <input
              readOnly
              value={newKey}
              style={{
                flex: "1 1 300px",
                height: "44px",
                padding: "0 12px",
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: "0.85rem",
                background: "#FFFFFF",
                border: "1px solid #D97706",
                borderRadius: "8px",
                color: "#92400E",
                fontWeight: 600,
                boxSizing: "border-box",
              }}
            />
            <button
              type="button"
              className="button primary"
              onClick={() => handleCopy(newKey, "new-key")}
              style={{
                height: "44px",
                padding: "0 1.25rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                background: "#D97706",
                borderColor: "#B45309",
                color: "#FFFFFF",
                fontWeight: 600,
              }}
            >
              {copied === "new-key" ? (
                <>
                  <Check size={16} /> Copiado!
                </>
              ) : (
                <>
                  <Copy size={16} /> Copiar Chave
                </>
              )}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => setNewKey(null)}
              style={{ height: "44px", padding: "0 1rem" }}
            >
              Concluído
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={handleTestConnection}
              disabled={testing}
              style={{ height: "44px", padding: "0 1rem" }}
            >
              {testing ? "Testando..." : "Testar conexão"}
            </button>
          </div>
          {testResult === "success" && (
            <div style={{ marginTop: "0.7rem", color: "#047857", fontSize: "0.82rem", fontWeight: 600 }}>
              <Check size={14} style={{ verticalAlign: "-2px", marginRight: "4px" }} />
              Conexão funcionando. Sua IA já pode consultar o Trackbase.
            </div>
          )}
        </div>
      )}

      {/* Cartão 1: Gerenciar Chaves */}
      <section
        className="panel"
        style={{
          borderRadius: "14px",
          border: "1px solid var(--line, #E2E8F0)",
          background: "var(--surface, #FFFFFF)",
          padding: "1.5rem",
        }}
      >
        <div style={{ marginBottom: "1.25rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.3rem",
            }}
          >
            <Key size={18} style={{ color: "var(--brand-accent, #5B34EA)" }} />
            <h2 style={{ fontSize: "1.1rem", margin: 0, fontWeight: 700 }}>
              Chaves de Acesso MCP
            </h2>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: "0.86rem",
              color: "var(--muted, #64748B)",
              lineHeight: 1.45,
            }}
          >
            Crie chaves de API exclusivas para autenticar seus assistentes de IA (Claude,
            Cursor, Codex) aos dados do seu workspace.
          </p>
        </div>

        {message && (
          <div
            role="alert"
            style={{
              marginBottom: "1rem",
              padding: "0.75rem 0.9rem",
              borderRadius: "9px",
              border: "1px solid var(--red-border, #FECACA)",
              background: "var(--red-soft, #FEF2F2)",
              color: "var(--red-text, #B91C1C)",
              fontSize: "0.82rem",
              lineHeight: 1.4,
            }}
          >
            {message}
          </div>
        )}

        {/* Formulário com layout estável (nunca estica na vertical) */}
        <form
          onSubmit={handleCreate}
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "stretch",
            gap: "10px",
            width: "100%",
            maxWidth: "680px",
            marginBottom: "1.5rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: "1 1 280px", minWidth: "240px" }}>
            <input
              type="text"
              placeholder="Nome da chave (ex: Claude Desktop Mac, Cursor)"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              disabled={loading}
              style={{
                width: "100%",
                height: "44px",
                padding: "0 14px",
                fontSize: "0.88rem",
                borderRadius: "8px",
                border: "1px solid var(--line, #CBD5E1)",
                background: "var(--surface-subtle, #F8FAFC)",
                color: "var(--ink, #0F172A)",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>
          <button
            type="submit"
            className="button primary"
            disabled={loading}
            style={{
              height: "44px",
              padding: "0 1.5rem",
              whiteSpace: "nowrap",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              fontWeight: 600,
            }}
          >
            <Sparkles size={16} />
            {loading ? "Gerando..." : "Criar Nova Chave"}
          </button>
        </form>

        {/* Lista de chaves ativas */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "0.75rem",
            }}
          >
            <span
              style={{
                fontSize: "0.8rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--muted, #64748B)",
              }}
            >
              Suas Chaves Ativas ({keys.length})
            </span>
          </div>

          {keys.length === 0 ? (
            <div
              style={{
                padding: "1.5rem",
                borderRadius: "10px",
                border: "1px dashed var(--line, #E2E8F0)",
                background: "var(--surface-subtle, #F8FAFC)",
                textAlign: "center",
                color: "var(--muted, #64748B)",
                fontSize: "0.86rem",
              }}
            >
              Nenhuma chave MCP ativa neste workspace. Clique em &quot;Criar Nova Chave&quot;
              acima para começar.
            </div>
          ) : (
            <div style={{ display: "grid", gap: "0.6rem" }}>
              {keys.map((k) => (
                <div
                  key={k.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.85rem 1.1rem",
                    border: "1px solid var(--line, #E2E8F0)",
                    borderRadius: "10px",
                    background: "var(--surface-subtle, #F8FAFC)",
                    gap: "1rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ minWidth: "200px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        marginBottom: "0.25rem",
                      }}
                    >
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: "#10B981",
                          display: "inline-block",
                        }}
                        title="Ativa"
                      />
                      <strong
                        style={{
                          fontSize: "0.9rem",
                          color: "var(--ink, #0F172A)",
                        }}
                      >
                        {k.name}
                      </strong>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "0.85rem",
                        fontSize: "0.78rem",
                        color: "var(--muted, #64748B)",
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <code
                        style={{
                          background: "var(--surface, #FFFFFF)",
                          border: "1px solid var(--line, #E2E8F0)",
                          borderRadius: "4px",
                          padding: "2px 6px",
                          fontFamily: "monospace",
                          fontSize: "0.75rem",
                        }}
                      >
                        {k.prefix}••••••••
                      </code>
                      <span>
                        Criada em:{" "}
                        {new Date(k.createdAt).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      {k.lastUsedAt && (
                        <span>
                          Último uso:{" "}
                          {new Date(k.lastUsedAt).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRevoke(k.id)}
                    style={{
                      background: "transparent",
                      border: "1px solid #FCA5A5",
                      color: "#DC2626",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Trash2 size={13} /> Revogar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Cartão 2: Como configurar passo a passo */}
      <section
        className="panel"
        style={{
          borderRadius: "14px",
          border: "1px solid var(--line, #E2E8F0)",
          background: "var(--surface, #FFFFFF)",
          padding: "1.5rem",
        }}
      >
        <div style={{ marginBottom: "1.25rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.3rem",
            }}
          >
            <Cpu size={18} style={{ color: "var(--brand-accent, #5B34EA)" }} />
            <h2 style={{ fontSize: "1.1rem", margin: 0, fontWeight: 700 }}>
              Como Configurar no seu Aplicativo de IA
            </h2>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: "0.86rem",
              color: "var(--muted, #64748B)",
            }}
          >
            Escolha o aplicativo que você usa. A configuração é feita em 3 passos e não
            exige conhecimento técnico.
          </p>
        </div>

        <div
          className="mcp-setup-callout"
          style={{
            display: "grid",
            gap: "0.45rem",
            marginBottom: "1.25rem",
            padding: "0.9rem 1rem",
            borderRadius: "10px",
            border: "1px solid var(--brand-border, #C4B5FD)",
            background: "var(--brand-soft, #F5F3FF)",
            color: "var(--ink, #0F172A)",
            fontSize: "0.84rem",
            lineHeight: 1.45,
          }}
        >
          <strong>{newKey ? "Pronto para conectar" : "Comece gerando sua chave"}</strong>
          <span style={{ color: "var(--muted, #64748B)" }}>
            1. Gere uma chave na caixa acima. 2. Copie a configuração da sua aba. 3. Cole
            no aplicativo e reinicie-o. A chave completa aparece uma única vez por
            segurança.
          </span>
        </div>

        {/* Seletor de Aplicativo */}
        <div
          className="mcp-app-tabs"
          style={{
            display: "flex",
            gap: "0.5rem",
            borderBottom: "1px solid var(--line, #E2E8F0)",
            paddingBottom: "0.85rem",
            marginBottom: "1.25rem",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className={`button ${activeTab === "claude" ? "primary" : "secondary"}`}
            onClick={() => setActiveTab("claude")}
            style={{
              fontSize: "0.84rem",
              padding: "0.5rem 1rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              fontWeight: 600,
            }}
          >
            <Sparkles size={15} /> Claude Desktop
          </button>
          <button
            type="button"
            className={`button ${activeTab === "cursor" ? "primary" : "secondary"}`}
            onClick={() => setActiveTab("cursor")}
            style={{
              fontSize: "0.84rem",
              padding: "0.5rem 1rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              fontWeight: 600,
            }}
          >
            <Code2 size={15} /> Cursor
          </button>
          <button
            type="button"
            className={`button ${activeTab === "codex" ? "primary" : "secondary"}`}
            onClick={() => setActiveTab("codex")}
            style={{
              fontSize: "0.84rem",
              padding: "0.5rem 1rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              fontWeight: 600,
            }}
          >
            <Code2 size={15} /> Codex
          </button>
          <button
            type="button"
            className={`button ${activeTab === "cli" ? "primary" : "secondary"}`}
            onClick={() => setActiveTab("cli")}
            style={{
              fontSize: "0.84rem",
              padding: "0.5rem 1rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              fontWeight: 600,
            }}
          >
            <Terminal size={15} /> Claude Code (Terminal)
          </button>
        </div>

        {/* Aba: Claude Desktop */}
        {activeTab === "claude" && (
          <div>
            <div
              style={{
                display: "grid",
                gap: "0.85rem",
                marginBottom: "1.25rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "0.85rem",
                  alignItems: "flex-start",
                  padding: "0.85rem 1rem",
                  borderRadius: "10px",
                  background: "var(--surface-subtle, #F8FAFC)",
                  border: "1px solid var(--line, #E2E8F0)",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "26px",
                    height: "26px",
                    borderRadius: "50%",
                    background: "var(--brand-accent, #5B34EA)",
                    color: "#FFFFFF",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  1
                </span>
                <div style={{ fontSize: "0.86rem", lineHeight: 1.5 }}>
                  <strong style={{ color: "var(--ink, #0F172A)" }}>
                    Abra o Claude Desktop e acesse as Configurações
                  </strong>
                  <div style={{ color: "var(--muted, #64748B)", marginTop: "2px" }}>
                    Pressione o atalho{" "}
                    <kbd
                      style={{
                        padding: "2px 6px",
                        background: "#E2E8F0",
                        borderRadius: "4px",
                        fontSize: "0.78rem",
                        fontFamily: "monospace",
                      }}
                    >
                      Ctrl + ,
                    </kbd>{" "}
                    (Windows) ou{" "}
                    <kbd
                      style={{
                        padding: "2px 6px",
                        background: "#E2E8F0",
                        borderRadius: "4px",
                        fontSize: "0.78rem",
                        fontFamily: "monospace",
                      }}
                    >
                      Cmd + ,
                    </kbd>{" "}
                    (Mac) e clique na aba <strong>Developer</strong>.
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "0.85rem",
                  alignItems: "flex-start",
                  padding: "0.85rem 1rem",
                  borderRadius: "10px",
                  background: "var(--surface-subtle, #F8FAFC)",
                  border: "1px solid var(--line, #E2E8F0)",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "26px",
                    height: "26px",
                    borderRadius: "50%",
                    background: "var(--brand-accent, #5B34EA)",
                    color: "#FFFFFF",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  2
                </span>
                <div style={{ fontSize: "0.86rem", lineHeight: 1.5 }}>
                  <strong style={{ color: "var(--ink, #0F172A)" }}>
                    Clique no botão &quot;Edit Config&quot;
                  </strong>
                  <div style={{ color: "var(--muted, #64748B)", marginTop: "2px" }}>
                    O próprio Claude abrirá o arquivo{" "}
                    <code>claude_desktop_config.json</code> no seu Bloco de Notas ou
                    editor favorito diretamente, sem você precisar procurar pastas
                    ocultas.
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "0.85rem",
                  alignItems: "flex-start",
                  padding: "0.85rem 1rem",
                  borderRadius: "10px",
                  background: "var(--surface-subtle, #F8FAFC)",
                  border: "1px solid var(--line, #E2E8F0)",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "26px",
                    height: "26px",
                    borderRadius: "50%",
                    background: "var(--brand-accent, #5B34EA)",
                    color: "#FFFFFF",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  3
                </span>
                <div style={{ fontSize: "0.86rem", lineHeight: 1.5 }}>
                  <strong style={{ color: "var(--ink, #0F172A)" }}>
                    Cole o código abaixo, salve o arquivo e reinicie o Claude
                  </strong>
                  <div style={{ color: "var(--muted, #64748B)", marginTop: "2px" }}>
                    Copie a configuração com 1 clique abaixo. Ela já inclui sua chave de
                    acesso:
                  </div>
                </div>
              </div>
            </div>

            {/* Snippet com botão de cópia */}
            <div style={{ position: "relative", marginTop: "0.5rem" }}>
              <pre
                style={{
                  background: "#0F172A",
                  color: "#E2E8F0",
                  padding: "1.25rem",
                  borderRadius: "10px",
                  fontSize: "0.84rem",
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  overflowX: "auto",
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {claudeConfig}
              </pre>
              <button
                type="button"
                className="button primary"
                onClick={() => handleCopyConfig(claudeConfig, "claude-json")}
                disabled={!newKey}
                title={newKey ? "Copiar configuração" : "Gere uma chave nova para liberar a configuração"}
                style={{
                  position: "absolute",
                  top: "12px",
                  right: "12px",
                  fontSize: "0.78rem",
                  padding: "6px 14px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  fontWeight: 600,
                  opacity: newKey ? 1 : 0.55,
                }}
              >
                {copied === "claude-json" ? (
                  <>
                    <Check size={14} /> Copiado!
                  </>
                ) : (
                  <>
                    <Copy size={14} /> Copiar JSON
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Aba: Cursor / Codex */}
        {activeTab === "cursor" && (
          <div>
            <p
              style={{
                margin: "0 0 1rem 0",
                fontSize: "0.86rem",
                color: "var(--muted, #64748B)",
                lineHeight: 1.5,
              }}
            >
              Abra o projeto que contém a pasta <code>bin</code> do Trackbase e crie ou
              edite <code>.cursor/mcp.json</code> na raiz. Cole o JSON abaixo, salve e
              reinicie o Cursor. Se o projeto estiver em outra pasta, troque o caminho do
              script pelo caminho absoluto da sua cópia do Trackbase.
            </p>
            <div style={{ position: "relative" }}>
              <pre
                style={{
                  background: "#0F172A",
                  color: "#E2E8F0",
                  padding: "1.25rem",
                  borderRadius: "10px",
                  fontSize: "0.84rem",
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  overflowX: "auto",
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {cursorConfig}
              </pre>
              <button
                type="button"
                className="button primary"
                onClick={() => handleCopyConfig(cursorConfig, "cursor-json")}
                disabled={!newKey}
                title={newKey ? "Copiar configuração" : "Gere uma chave nova para liberar a configuração"}
                style={{
                  position: "absolute",
                  top: "12px",
                  right: "12px",
                  fontSize: "0.78rem",
                  padding: "6px 14px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  fontWeight: 600,
                  opacity: newKey ? 1 : 0.55,
                }}
              >
                {copied === "cursor-json" ? (
                  <>
                    <Check size={14} /> Copiado!
                  </>
                ) : (
                  <>
                    <Copy size={14} /> Copiar JSON
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Aba: Codex */}
        {activeTab === "codex" && (
          <div className="mcp-codex-guide">
            <div className="mcp-guide-intro">
              <strong>Conectar no Codex Desktop, CLI ou extensão</strong>
              <span>
                O Codex usa o mesmo arquivo de configuração nos três lugares. Você só
                precisa salvar a chave como variável do Windows e reiniciar o Codex.
              </span>
            </div>

            <div className="mcp-guide-steps">
              <div className="mcp-guide-step">
                <span>1</span>
                <div>
                  <strong>Abra a configuração do Codex</strong>
                  <p>
                    No Codex, abra <code>Settings → MCP servers → Add server</code>. Se
                    preferir editar arquivo, abra <code>~/.codex/config.toml</code>.
                  </p>
                </div>
              </div>
              <div className="mcp-guide-step">
                <span>2</span>
                <div>
                  <strong>Copie o bloco TOML abaixo</strong>
                  <p>Ele aponta para o servidor online do Trackbase e usa sua chave com segurança.</p>
                </div>
              </div>
              <div className="mcp-guide-step">
                <span>3</span>
                <div>
                  <strong>Salve a chave no Windows</strong>
                  <p>Abra o PowerShell, cole o comando abaixo, reinicie o Codex e pronto.</p>
                </div>
              </div>
            </div>

            <div className="mcp-code-block" style={{ position: "relative" }}>
              <pre
                style={{
                  background: "#0F172A",
                  color: "#E2E8F0",
                  padding: "1.25rem",
                  borderRadius: "10px",
                  fontSize: "0.84rem",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  overflowX: "auto",
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {codexConfig}
              </pre>
              <button
                type="button"
                className="button primary"
                onClick={() => handleCopyConfig(codexConfig, "codex-config")}
                disabled={!newKey}
                title={newKey ? "Copiar configuração" : "Gere uma chave nova para liberar a configuração"}
                style={{
                  position: "absolute",
                  top: "12px",
                  right: "12px",
                  fontSize: "0.78rem",
                  padding: "6px 14px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  fontWeight: 600,
                  opacity: newKey ? 1 : 0.55,
                }}
              >
                {copied === "codex-config" ? <><Check size={14} /> Copiado!</> : <><Copy size={14} /> Copiar TOML</>}
              </button>
            </div>

            <p className="mcp-code-caption">
              No PowerShell do Windows, copie e execute este comando. Ele salva a chave
              apenas no seu usuário — nunca compartilhe esse valor.
            </p>
            <div className="mcp-code-block" style={{ position: "relative" }}>
              <pre
                style={{
                  background: "#0F172A",
                  color: "#E2E8F0",
                  padding: "1.25rem",
                  borderRadius: "10px",
                  fontSize: "0.84rem",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  overflowX: "auto",
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {codexEnvCommand}
              </pre>
              <button
                type="button"
                className="button primary"
                onClick={() => handleCopyConfig(codexEnvCommand, "codex-env")}
                disabled={!newKey}
                title={newKey ? "Copiar comando" : "Gere uma chave nova para liberar o comando"}
                style={{
                  position: "absolute",
                  top: "12px",
                  right: "12px",
                  fontSize: "0.78rem",
                  padding: "6px 14px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  fontWeight: 600,
                  opacity: newKey ? 1 : 0.55,
                }}
              >
                {copied === "codex-env" ? <><Check size={14} /> Copiado!</> : <><Copy size={14} /> Copiar comando</>}
              </button>
            </div>

            <div className="mcp-setup-callout mcp-setup-success">
              Depois de reiniciar, abra um chat e execute <code>/mcp</code>. O Trackbase
              deve aparecer como servidor conectado.
            </div>
          </div>
        )}

        {/* Aba: Claude Code (CLI) */}
        {activeTab === "cli" && (
          <div>
            <p
              style={{
                margin: "0 0 1rem 0",
                fontSize: "0.86rem",
                color: "var(--muted, #64748B)",
                lineHeight: 1.5,
              }}
            >
              Se você usa o <strong>Claude Code</strong> no terminal, basta rodar o comando
              único abaixo:
            </p>
            <div style={{ position: "relative" }}>
              <pre
                style={{
                  background: "#0F172A",
                  color: "#E2E8F0",
                  padding: "1.25rem",
                  borderRadius: "10px",
                  fontSize: "0.84rem",
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  overflowX: "auto",
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {cliCommand}
              </pre>
              <button
                type="button"
                className="button primary"
                onClick={() => handleCopy(cliCommand, "cli-cmd")}
                style={{
                  position: "absolute",
                  top: "12px",
                  right: "12px",
                  fontSize: "0.78rem",
                  padding: "6px 14px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  fontWeight: 600,
                }}
              >
                {copied === "cli-cmd" ? (
                  <>
                    <Check size={14} /> Copiado!
                  </>
                ) : (
                  <>
                    <Copy size={14} /> Copiar Comando
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Cartão 3: O que o Claude pode fazer */}
      <section
        className="panel"
        style={{
          borderRadius: "14px",
          border: "1px solid var(--line, #E2E8F0)",
          background: "var(--surface, #FFFFFF)",
          padding: "1.5rem",
        }}
      >
        <div style={{ marginBottom: "1.25rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.3rem",
            }}
          >
            <Layers size={18} style={{ color: "var(--brand-accent, #5B34EA)" }} />
            <h2 style={{ fontSize: "1.1rem", margin: 0, fontWeight: 700 }}>
              O que a sua IA pode fazer conectada ao Trackbase
            </h2>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: "0.86rem",
              color: "var(--muted, #64748B)",
            }}
          >
            O protocolo MCP dá superpoderes ao seu Claude ou editor para analisar e agir
            sobre o seu negócio.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "0.85rem",
          }}
        >
          {[
            {
              name: "get_metrics",
              title: "Métricas e Faturamento Real",
              desc: "Consulta faturamento bruto/líquido, vendas aprovadas, ticket médio, reembolsos e ROAS real por período.",
            },
            {
              name: "list_campaigns",
              title: "Análise de Campanhas",
              desc: "Lista todas as campanhas ativas do Meta Ads e Google Ads com gastos, cliques, CPA e receita gerada.",
            },
            {
              name: "list_offers",
              title: "Catálogo de Ofertas e Checkouts",
              desc: "Acessa ofertas cadastradas, links de checkout (Hotmart, Kiwify, Cakto) e páginas de venda.",
            },
            {
              name: "create_tracking_link",
              title: "Criação de Links com UTMs",
              desc: "Gera links de rastreio com parâmetros completos (origem, campanha, criativo) e link encurtado na hora.",
            },
            {
              name: "get_recent_sales",
              title: "Feed de Vendas em Tempo Real",
              desc: "Verifica vendas recentes minuto a minuto com detalhes de comprador, método de pagamento e gateway.",
            },
            {
              name: "get_mined_offers",
              title: "Espionagem de Anúncios e Ofertas",
              desc: "Analisa anúncios minerados de concorrentes com dias ativos, títulos e criativos que mais escalam.",
            },
          ].map((tool) => (
            <div
              key={tool.name}
              style={{
                border: "1px solid var(--line, #E2E8F0)",
                borderRadius: "10px",
                padding: "1rem",
                background: "var(--surface-subtle, #F8FAFC)",
                display: "flex",
                flexDirection: "column",
                gap: "0.35rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <strong
                  style={{
                    fontSize: "0.88rem",
                    color: "var(--ink, #0F172A)",
                  }}
                >
                  {tool.title}
                </strong>
                <code
                  style={{
                    color: "var(--brand-accent, #5B34EA)",
                    fontWeight: 700,
                    fontSize: "0.72rem",
                    background: "rgba(91, 52, 234, 0.08)",
                    padding: "2px 6px",
                    borderRadius: "4px",
                  }}
                >
                  {tool.name}
                </code>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.8rem",
                  color: "var(--muted, #64748B)",
                  lineHeight: 1.45,
                }}
              >
                {tool.desc}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
