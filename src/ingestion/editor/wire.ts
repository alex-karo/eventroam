import { z } from "zod";
import { editorPlanSchema, readyEditorPlanSchema } from "./contracts";
import { modelOutputSchema } from "../research/agent/wire";

// Strict providers require an object at the root. Branch requirements are
// enforced by editorPlanSchema locally, not by a root anyOf in transport.
export function editorModelOutputSchema() {
  return modelOutputSchema(
    z.strictObject({
      status: z.enum([
        readyEditorPlanSchema.shape.status.value,
        editorPlanSchema.options[1].shape.status.value,
      ]),
      event: readyEditorPlanSchema.shape.event,
      editions: readyEditorPlanSchema.shape.editions,
      unresolved: readyEditorPlanSchema.shape.unresolved,
      reason: editorPlanSchema.options[1].shape.reason.nullable(),
    }),
  );
}

// Optional null slots and empty rejection placeholders represent omission.
// Required ready arrays and action members stay intact
// so malformed clear/keep/set variants still fail strict local validation.
const eventFields = Object.keys(
  readyEditorPlanSchema.shape.event.unwrap().shape.fields.shape,
);
const editionFields = Object.keys(
  readyEditorPlanSchema.shape.editions.element.shape.fields.shape,
);
const optional = new Set([
  "reason",
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
      .filter(([key, part]) => {
        if (
          path.length === 0 &&
          "status" in value &&
          value.status === "rejected"
        ) {
          if (key === "event" && part === null) {
            return false;
          }
          if (
            (key === "editions" || key === "unresolved") &&
            Array.isArray(part) &&
            part.length === 0
          ) {
            return false;
          }
        }
        return part !== null || !optional.has([...path, key].join("."));
      })
      .map(([key, part]) => [key, normalizeEditorWire(part, [...path, key])]),
  );
}
