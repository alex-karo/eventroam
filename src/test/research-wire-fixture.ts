export function wireCandidate(
  request: Record<string, unknown>,
  value: unknown,
): unknown {
  const root = (
    request.response_format as {
      json_schema: { schema: Record<string, unknown> };
    }
  ).json_schema.schema;
  const fill = (schema: Record<string, unknown>, part: unknown): unknown => {
    if (typeof schema.$ref === "string") {
      const ref = schema.$ref
        .replace(/^#\//, "")
        .split("/")
        .reduce<unknown>(
          (node, key) => (node as Record<string, unknown>)[key],
          root,
        );
      return fill(ref as Record<string, unknown>, part);
    }
    if (Array.isArray(schema.anyOf)) {
      if (part === null || part === undefined) {
        return null;
      }
      const kind = (part as { kind?: string }).kind;
      const branch = schema.anyOf.find((item) => {
        const candidate = item as {
          type?: string;
          properties?: { kind?: { const?: string; enum?: string[] } };
        };
        const discriminator = candidate.properties?.kind;
        return (
          candidate.type !== "null" &&
          (!discriminator ||
            discriminator.const === kind ||
            (kind !== undefined && discriminator.enum?.includes(kind)))
        );
      });
      return fill(branch as Record<string, unknown>, part);
    }
    if (
      schema.type === "object" &&
      schema.properties &&
      typeof schema.properties === "object"
    ) {
      const fields = part as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(schema.properties).map(([key, child]) => [
          key,
          fields?.[key] === undefined
            ? null
            : fill(child as Record<string, unknown>, fields[key]),
        ]),
      );
    }
    if (schema.type === "array" && Array.isArray(part)) {
      return part.map((entry) =>
        fill(schema.items as Record<string, unknown>, entry),
      );
    }
    return part;
  };
  return fill(root, value);
}
