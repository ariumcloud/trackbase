#!/usr/bin/env node
import readline from "node:readline";

const apiKey = process.env.TRACKBASE_API_KEY || "";
const apiUrl = (process.env.TRACKBASE_API_URL || "https://trackbase.com.br").replace(/\/$/, "");

if (!apiKey || !apiKey.startsWith("tb_live_")) {
  console.error("ERRO: Variável de ambiente TRACKBASE_API_KEY ausente ou inválida.");
  console.error("Gere sua chave em seu painel Trackbase em Integrações > MCP / Claude / Codex.");
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  try {
    const message = JSON.parse(trimmed);
    const response = await fetch(`${apiUrl}/api/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    process.stdout.write(JSON.stringify(result) + "\n");
  } catch (err) {
    const errorResponse = {
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32603,
        message: err instanceof Error ? err.message : "Erro interno no client MCP",
      },
    };
    process.stdout.write(JSON.stringify(errorResponse) + "\n");
  }
});
