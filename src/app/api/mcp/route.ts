import { NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-keys";
import { executeMcpMethod, type McpRequest } from "@/lib/mcp-server";
import { rateLimit } from "@/lib/security";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const auth = await validateApiKey(authHeader);

  if (!auth) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32001,
          message: "Não autorizado. Forneça um header 'Authorization: Bearer tb_live_...'",
        },
      },
      { status: 401 },
    );
  }

  const allowed = await rateLimit(`mcp:${auth.workspaceId}`, 60);
  if (!allowed) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32000,
          message: "Limite de requisições excedido. Aguarde um momento.",
        },
      },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error: JSON inválido" },
      },
      { status: 400 },
    );
  }

  // Handle single request or batch requests
  if (Array.isArray(body)) {
    const responses = await Promise.all(
      body.map(async (req: McpRequest) => {
        try {
          const result = await executeMcpMethod(
            auth.workspaceId,
            auth.userId,
            req.method,
            req.params || {},
          );
          return { jsonrpc: "2.0", id: req.id ?? null, result };
        } catch (err: unknown) {
          return {
            jsonrpc: "2.0",
            id: req.id ?? null,
            error: {
              code: -32603,
              message: err instanceof Error ? err.message : "Erro interno",
            },
          };
        }
      }),
    );
    return NextResponse.json(responses);
  }

  const req = body as McpRequest;
  if (!req.method) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: req.id ?? null,
        error: { code: -32600, message: "Invalid Request: método ausente" },
      },
      { status: 400 },
    );
  }

  try {
    const result = await executeMcpMethod(
      auth.workspaceId,
      auth.userId,
      req.method,
      req.params || {},
    );
    return NextResponse.json({ jsonrpc: "2.0", id: req.id ?? null, result });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: req.id ?? null,
        error: {
          code: -32603,
          message: err instanceof Error ? err.message : "Erro interno",
        },
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyParam = searchParams.get("key");
  const authHeader = request.headers.get("authorization") || (keyParam ? `Bearer ${keyParam}` : "");
  const auth = authHeader ? await validateApiKey(authHeader) : null;

  return NextResponse.json({
    name: "trackbase-mcp",
    version: "1.0.0",
    status: "online",
    authenticated: !!auth,
    workspace: auth ? auth.workspaceId : null,
    docs: "https://trackbase.com.br",
  });
}
