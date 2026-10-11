import { editorPlanSchema } from "./contracts";

// Provider-only null slots represent omission. Required action members stay intact
// so malformed clear/keep/set variants still fail strict local validation.
const eventFields = Object.keys(
  editorPlanSchema.shape.event.unwrap().shape.fields.shape,
);
const editionFields = Object.keys(
  editorPlanSchema.shape.editions.element.shape.fields.shape,
);
const optional = new Set([
  ...eventFields.map((field) => `event.fields.${field}`),
  ...editionFields.map((field) => `editions.*.fields.${field}`),
  "event.fields.links.website",
  "event.fields.links.socials",
  "editions.*.fields.links.tickets",
  ...["instagram", "facebook", "youtube", "tiktok", "x", "other"].map(
    (key) => `event.fields.links.socials.${key}`,
  ),
  ...["amount", "currency", "terms", "availability", "url"].map(
    (key) => `editions.*.fields.tickets.value.variants.*.${key}`,
  ),
  "editions.*.fields.tickets.value.basePrice.qualification",
  ...["editionKey", "field"].map((key) => `unresolved.*.${key}`),
]);
export function normalizeEditorWire(
  value: unknown,
  path: string[] = [],
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeEditorWire(item, [...path, "*"]));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key, part]) =>
          part !== null || !optional.has([...path, key].join(".")),
      )
      .map(([key, part]) => [key, normalizeEditorWire(part, [...path, key])]),
  );
}
