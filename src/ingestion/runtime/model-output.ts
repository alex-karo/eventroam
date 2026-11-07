import { z } from "zod";

// OpenRouter's strict response_format accepts shape rather than Zod's optional
// properties or validation keywords. Strict Zod validation still runs locally.
export function modelOutputSchema(output: z.ZodType) {
  const stripped = new Set([
    "$schema",
    "format",
    "pattern",
    "minLength",
    "maxLength",
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "minItems",
    "maxItems",
  ]);
  const clean = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(clean);
    }
    if (!value || typeof value !== "object") {
      return value;
    }
    const original = value as Record<string, unknown>;
    const result = Object.fromEntries(
      Object.entries(original)
        .filter(([key]) => !stripped.has(key))
        .map(([key, part]) => [key === "oneOf" ? "anyOf" : key, clean(part)]),
    );
    if (
      result.type === "object" &&
      result.properties &&
      typeof result.properties === "object"
    ) {
      const properties = result.properties as Record<string, unknown>;
      const required = new Set(
        Array.isArray(original.required) ? original.required : [],
      );
      for (const [key, property] of Object.entries(properties)) {
        if (!required.has(key)) {
          properties[key] = { anyOf: [property, { type: "null" }] };
        }
      }
      result.required = Object.keys(properties);
      result.additionalProperties = false;
    }
    return result;
  };
  const schema = z.toJSONSchema(output);
  return clean(schema) as typeof schema;
}

/** Read only the final model step if structured output failed wire checks. */
export function completedObject(output: {
  object?: unknown;
  steps: { text?: string }[];
}) {
  if (output.object != null) {
    return output.object;
  }
  try {
    const value: unknown = JSON.parse(output.steps.at(-1)?.text ?? "");
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : null;
  } catch {
    return null;
  }
}
