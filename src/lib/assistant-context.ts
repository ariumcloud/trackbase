const SENSITIVE_CONTEXT_KEY = /(?:e-?mail|phone|telefone|celular|nome|name|buyer|cliente|customer|cpf|document|address|endereco|(?:^|_)ip(?:$|_)|user.?agent|cookie|token|secret|password|(?:^|_)url(?:$|_)|landing|checkout|public_key|attribution)/i;

export function sanitizeAssistantContext(value: unknown, depth = 0): unknown {
  if (depth > 5 || value === null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.slice(0, 500);
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeAssistantContext(item, depth + 1));
  }
  if (typeof value !== "object") return null;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !SENSITIVE_CONTEXT_KEY.test(key))
      .slice(0, 50)
      .map(([key, item]) => [key, sanitizeAssistantContext(item, depth + 1)]),
  );
}

export function serializeAssistantContext(value: unknown, maxChars: number) {
  const serialized = JSON.stringify(sanitizeAssistantContext(value) ?? {});
  if (serialized.length > maxChars) throw new Error("CONTEXT_TOO_LARGE");
  return serialized;
}
