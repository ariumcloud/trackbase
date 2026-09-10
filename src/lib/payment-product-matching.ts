function stripProviderPrefix(value: string): string {
  return value.replace(/^[a-z]+\s*[·•:-]\s*/i, "");
}

export function normalizeComparableProductName(value: unknown): string {
  return stripProviderPrefix(String(value || ""))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function hotmartProductNamesMatch(
  configuredName: unknown,
  webhookName: unknown,
): boolean {
  const configured = normalizeComparableProductName(configuredName);
  const received = normalizeComparableProductName(webhookName);
  return configured !== "" && configured === received;
}
