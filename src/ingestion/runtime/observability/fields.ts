export function nonnegative(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

/** Technical identifiers, never arbitrary provider envelopes or display text. */
export function technicalId(value: unknown): string | undefined {
  return typeof value === "string" &&
    value.length <= 160 &&
    /^[a-zA-Z0-9][a-zA-Z0-9_./:@+-]*$/.test(value)
    ? value
    : undefined;
}
