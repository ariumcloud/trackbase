import { NextResponse } from "next/server";
import { assistantResponse, responseText } from "@/lib/assistant-transport";
import { z } from "zod";
import { serializeAssistantContext } from "@/lib/assistant-context";
import { authorize, body, rateLimit } from "@/lib/security";

const MAX_REQUEST_BYTES = 24_576;
const MAX_CONTEXT_CHARS = 12_000;
const OPENAI_TIMEOUT_MS = 20_000;
const ASSISTANT_REQUESTS_PER_MINUTE = 20;

const requestSchema = z.object({
  workspace: z.string().uuid(),
  query: z.string().trim().min(1).max(2_000),
  context: z.unknown().optional(),
}).strict();

const SYSTEM = `Você é o Assistente Trackbase, especialista em direct response, mídia paga, funis e CRO.
Responda em português brasileiro, de forma prática e clara. Use somente os dados agregados fornecidos do workspace; nunca invente métricas, campanhas, vendas ou benchmarks. Diferencie fato observado, hipótese e recomendação. Não mande pausar ou escalar algo sem volume mínimo e explique incertezas. Quando não houver dados suficientes, diga exatamente quais dados faltam. Não dê aconselhamento jurídico, médico ou financeiro personalizado. Para recomendações de mídia, considere atribuição, janela, CPA alvo, margem, volume e significância; não use uma regra fixa isoladamente.`;

function unavailable(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await body(request, MAX_REQUEST_BYTES));
    if (!parsed.success) return unavailable("Solicitação inválida.", 400);

    const { workspace, query, context } = parsed.data;
    const { user } = await authorize(workspace, false);
    const allowed = await rateLimit(`assistant:${workspace}:${user.id}`, ASSISTANT_REQUESTS_PER_MINUTE);
    if (!allowed) return unavailable("Limite de consultas atingido. Tente novamente em instantes.", 429);
    if (!process.env.OPENAI_API_KEY) return unavailable("Assistente IA indisponível no momento.", 503);

    const contextJson = serializeAssistantContext(context, MAX_CONTEXT_CHARS);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
    let response: Response;
    try {
      response = await assistantResponse({
          instructions: SYSTEM,
          input: `Dados agregados e minimizados do workspace (JSON):\n${contextJson}\n\nPergunta do usuário:\n${query}`,
          max_output_tokens: 900,
      }, controller.signal);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return unavailable("O Assistente demorou mais que o esperado. Tente novamente.", 504);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 429) return unavailable("O Assistente está com muitas solicitações. Tente novamente em instantes.", 429);
    if (response.status >= 500) return unavailable("Assistente IA indisponível no momento.", 503);
    if (!response.ok) return unavailable("Não foi possível consultar o Assistente agora.", 502);

    const data = await response.json() as { output_text?: unknown };
    const text = responseText(data) || "Não consegui gerar uma resposta agora.";
    return NextResponse.json({ text });
  } catch (error) {
    if (error instanceof z.ZodError) return unavailable("Solicitação inválida.", 400);
    if (error instanceof SyntaxError) return unavailable("Solicitação inválida.", 400);
    if (error instanceof Error && error.message === "Payload excede o limite.") return unavailable("Solicitação excede o limite permitido.", 413);
    if (error instanceof Error && error.message === "CONTEXT_TOO_LARGE") return unavailable("O contexto da análise excede o limite permitido.", 413);
    if (error instanceof Error && error.message === "Entre na sua conta.") return unavailable("Entre na sua conta para usar o Assistente.", 401);
    if (error instanceof Error && error.message === "Workspace não autorizado.") return unavailable("Workspace não autorizado.", 403);
    console.error("assistant request failed", { kind: error instanceof Error ? error.name : "unknown" });
    return unavailable("Assistente IA indisponível no momento.", 503);
  }
}
