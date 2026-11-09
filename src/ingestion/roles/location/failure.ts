const errorTypes = new Map<string, string>([
  ["Error", "error"],
  ["MastraError", "mastra"],
  ["AI_APICallError", "api_call"],
  ["AI_RetryError", "retry"],
  ["AI_NoObjectGeneratedError", "no_object_generated"],
  ["AI_TypeValidationError", "type_validation"],
  ["AbortError", "aborted"],
  ["TimeoutError", "timeout"],
  ["TypeError", "type_error"],
]);

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Read only selected fields. Never copy SDK messages or transport payloads. */
export function locationFailureMessage(error: unknown): string {
  let type = "unknown";
  let httpStatus: number | undefined;
  let providerCode: string | undefined;
  let current = record(error);
  const seen = new Set<object>();
  for (let depth = 0; depth < 5 && current && !seen.has(current); depth++) {
    seen.add(current);
    if (typeof current.name === "string") {
      const known = errorTypes.get(current.name);
      if (known && (known !== "error" || type === "unknown")) {
        type = known;
      }
    }
    const status = current.statusCode;
    if (
      httpStatus === undefined &&
      typeof status === "number" &&
      Number.isInteger(status) &&
      status >= 400 &&
      status <= 599
    ) {
      httpStatus = status;
    }
    const data = record(current.data);
    const metadata = record((record(data?.error) ?? data)?.metadata);
    if (metadata?.error_type === "provider_unavailable") {
      providerCode = "provider_unavailable";
    }
    current = record(current.cause);
  }
  const fields = [
    `type=${type}`,
    ...(httpStatus === undefined ? [] : [`httpStatus=${httpStatus}`]),
    ...(providerCode ? [`providerCode=${providerCode}`] : []),
  ];
  return `Location execution or validation failed (${fields.join("; ")})`;
}
