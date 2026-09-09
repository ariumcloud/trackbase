import test from "node:test";
import assert from "node:assert/strict";
import { executeMcpMethod } from "../src/lib/mcp-server";

test("MCP Protocol: initialize retorna protocolo e capacidades corretas", async () => {
  const result = (await executeMcpMethod("test-workspace", "test-user", "initialize")) as {
    protocolVersion: string;
    serverInfo: { name: string; version: string };
    capabilities: { tools: unknown };
  };
  assert.equal(result.serverInfo.name, "trackbase-mcp");
  assert.equal(result.protocolVersion, "2024-11-05");
  assert.ok(result.capabilities.tools);
});

test("MCP Protocol: tools/list lista todas as ferramentas de IA para tráfego pago", async () => {
  const result = (await executeMcpMethod("test-workspace", "test-user", "tools/list")) as {
    tools: Array<{ name: string; description: string; inputSchema: unknown }>;
  };
  assert.ok(Array.isArray(result.tools));
  const names = result.tools.map((t) => t.name);
  assert.ok(names.includes("get_metrics"));
  assert.ok(names.includes("list_campaigns"));
  assert.ok(names.includes("list_offers"));
  assert.ok(names.includes("create_tracking_link"));
  assert.ok(names.includes("get_recent_sales"));
  assert.ok(names.includes("get_mined_offers"));
});

test("MCP Protocol: ping e notifications retornam sucesso imediato", async () => {
  const ping = await executeMcpMethod("test-workspace", "test-user", "ping");
  assert.deepEqual(ping, {});

  const notif = await executeMcpMethod("test-workspace", "test-user", "notifications/initialized");
  assert.deepEqual(notif, {});
});

test("MCP Protocol: rejeita ferramentas inexistentes", async () => {
  await assert.rejects(
    async () => {
      await executeMcpMethod("test-workspace", "test-user", "tools/call", { name: "unknown_tool" });
    },
    { message: /Tool desconhecida/ },
  );
});
