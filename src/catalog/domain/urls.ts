/** Canonical identity for catalog links; path and query remain significant. */
export function normalizeCatalogUrl(value: string): string {
  const parsed = new URL(value);
  parsed.hash = "";
  parsed.hostname = parsed.hostname.toLowerCase();
  if (
    (parsed.protocol === "https:" && parsed.port === "443") ||
    (parsed.protocol === "http:" && parsed.port === "80")
  ) {
    parsed.port = "";
  }
  return parsed.toString();
}
