import { NextResponse } from "next/server";
import { authorize } from "@/lib/security";

const SYSTEM = `Você é o Assistente Trackbase, especialista em direct response, mídia paga, funis e CRO.
Responda em português brasileiro, de forma prática e clara. Use somente os dados fornecidos do workspace; nunca invente métricas, campanhas, vendas ou benchmarks. Diferencie fato observado, hipótese e recomendação. Não mande pausar ou escalar algo sem volume mínimo e explique incertezas. Quando não houver dados suficientes, diga exatamente quais dados faltam. Não dê aconselhamento jurídico, médico ou financeiro personalizado. Para recomendações de mídia, considere atribuição, janela, CPA alvo, margem, volume e significância; não use uma regra fixa isoladamente.`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const workspace = typeof body.workspace === "string" ? body.workspace : "";
    const query = typeof body.query === "string" ? body.query.trim() : "";
    if (!workspace || !query || query.length > 2000) return NextResponse.json({ error: "Pergunta inválida." }, { status: 400 });
    await authorize(workspace, false);
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Assistente IA ainda não configurado no servidor." }, { status: 503 });

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
        instructions: SYSTEM,
        input: `Contexto atual do workspace (JSON):\n${JSON.stringify(body.context)}\n\nPergunta do cliente:\n${query}`,
        max_output_tokens: 900,
        store: false,
      }),
    });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: "Não foi possível consultar o Assistente agora." }, { status: 502 });
    return NextResponse.json({ text: data.output_text || "Não consegui gerar uma resposta agora." });
  } catch (error) {
    console.error("assistant error", error);
    return NextResponse.json({ error: "Erro ao consultar o Assistente." }, { status: 500 });
  }
}
