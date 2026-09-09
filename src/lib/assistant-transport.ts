import "server-only";

export async function assistantResponse(
  payload: Record<string, unknown>,
  signal: AbortSignal,
) {
  return fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    signal,
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      store: false,
      ...payload,
    }),
  });
}
export function responseText(data: {
  output_text?: unknown;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
}) {
  if (typeof data.output_text === "string") return data.output_text;
  return (data.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text || "")
    .join("");
}
