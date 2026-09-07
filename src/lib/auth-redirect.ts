const ALLOWED_AUTH_CALLBACK_PATHS = new Set([
  "/painel",
  "/recuperar-senha/atualizar",
]);

export function authCallbackPath(next: string | null) {
  return next && ALLOWED_AUTH_CALLBACK_PATHS.has(next) ? next : "/painel";
}
