export function appUrl(): string {
  const value = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (!value) throw new Error("APP_URL não configurado");
  return value;
}
