import { z } from "zod";
import {
  editorPlanSchema,
  readyEditorPlanSchema,
  editionFieldsSchema,
} from "@/test/ingestion-fixtures/editor-contracts";
import { editionSlotNames } from "@/ingestion/research/contracts";
import { modelOutputSchema } from "@/test/ingestion-fixtures/research-wire";

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
      previousEdition: readyEditorPlanSchema.shape.previousEdition,
      currentOrNextEdition: readyEditorPlanSchema.shape.currentOrNextEdition,
      unresolved: readyEditorPlanSchema.shape.unresolved,
      reason: editorPlanSchema.options[1].shape.reason.nullable(),
    }),
  );
}

// Optional null slots and empty rejection placeholders represent omission.
// Required Edition slots and action members stay intact
// so malformed clear/keep/set variants still fail strict local validation.
const eventFields = Object.keys(
  readyEditorPlanSchema.shape.event.unwrap().shape.fields.shape,
);
const editionFields = Object.keys(editionFieldsSchema.shape);
const optional = new Set([
  "reason",
  "event.reason",

  ...eventFields.map((field) => `event.fields.${field}`),

  "event.fields.links.website",
  "event.fields.links.socials",

  ...["instagram", "facebook", "youtube", "tiktok", "x", "other"].map(
    (key) => `event.fields.links.socials.${key}`,
  ),
  ...editionSlotNames.flatMap((slot) => [
    `${slot}.reason`,
    ...editionFields.map((field) => `${slot}.fields.${field}`),
    `${slot}.fields.links.tickets`,
    ...["amount", "currency", "terms", "availability", "url"].map(
      (key) => `${slot}.fields.tickets.value.variants.*.${key}`,
    ),
    `${slot}.fields.tickets.value.basePrice.qualification`,
  ]),
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
          if (
            (key === "event" ||
              editionSlotNames.some((slot) => slot === key)) &&
            part === null
          ) {
            return false;
          }
          if (
            key === "unresolved" &&
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
