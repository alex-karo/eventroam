import { z } from "zod";
import {
  researchDataSchema,
  researchQuestionSchema,
} from "../research/contracts";

export const EDITOR_PROMPT_VERSION = "catalog-editor-v13";
const reason = z.string().trim().min(1).max(500);
const keep = z.strictObject({ action: z.literal("keep"), reason });
const accept = z.strictObject({ action: z.literal("accept") });
const clear = z.strictObject({ action: z.literal("clear"), reason });
function action<T extends z.ZodType>(value: T) {
  return z.discriminatedUnion("action", [
    z.strictObject({ action: z.literal("set"), value, reason }),
    keep,
    accept,
  ]);
}
function clearable<T extends z.ZodType>(value: T) {
  return z.discriminatedUnion("action", [
    z.strictObject({ action: z.literal("set"), value, reason }),
    keep,
    accept,
    clear,
  ]);
}
const facts = researchDataSchema.shape.editions.element.shape;
const text = (max: number) => z.string().trim().min(1).max(max);
const link = clearable(z.url().refine((url) => /^https?:\/\//.test(url)));
export const eventFieldsSchema = z.strictObject({
  summary: clearable(text(2000)).optional(),
  links: z
    .strictObject({
      website: link.optional(),
      socials: z
        .strictObject({
          instagram: link.optional(),
          facebook: link.optional(),
          youtube: link.optional(),
          tiktok: link.optional(),
          x: clearable(
            z
              .url()
              .refine(
                (url) =>
                  /^https?:\/\//.test(url) &&
                  URL.canParse(url) &&
                  [
                    "x.com",
                    "twitter.com",
                    "www.x.com",
                    "www.twitter.com",
                  ].includes(new URL(url).hostname.toLowerCase()),
              ),
          ).optional(),
          other: link.optional(),
        })
        .optional(),
    })
    .optional(),
});
export const editionFieldsSchema = z.strictObject({
  year: action(facts.year.unwrap().shape.value).optional(),
  dates: clearable(facts.dates.unwrap().shape.value.unwrap()).optional(),
  coordinates: clearable(
    facts.coordinates.unwrap().shape.value.unwrap(),
  ).optional(),
  scheduleStatus: action(facts.scheduleStatus.unwrap().shape.value).optional(),
  displayName: clearable(text(250)).optional(),
  venueName: clearable(text(250)).optional(),
  venueAddress: clearable(text(500)).optional(),
  locality: clearable(text(250)).optional(),
  administrativeArea: clearable(text(250)).optional(),
  countryCode: clearable(
    facts.countryCode.unwrap().shape.value.unwrap(),
  ).optional(),
  sizeEstimate: clearable(
    facts.sizeEstimate.unwrap().shape.value.unwrap(),
  ).optional(),
  tickets: clearable(facts.tickets.unwrap().shape.value).optional(),
  classification: clearable(
    facts.classification
      .unwrap()
      .shape.value.refine((ids) => new Set(ids).size === ids.length),
  ).optional(),
  links: z.strictObject({ tickets: link.optional() }).optional(),
});
export const readyEditorPlanSchema = z
  .strictObject({
    status: z.literal("ready"),
    event: z
      .strictObject({
        reason: reason.optional(),
        fields: eventFieldsSchema,
      })
      .nullable(),
    editions: z
      .array(
        z.strictObject({
          editionKey: facts.key,
          reason: reason.optional(),
          fields: editionFieldsSchema,
        }),
      )
      .max(20),
    unresolved: z.array(researchQuestionSchema).max(30),
  })
  .superRefine((plan, ctx) => {
    const keys = plan.editions.map((edition) => edition.editionKey);
    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({
        code: "custom",
        path: ["editions"],
        message: "Duplicate Edition target",
      });
    }
    if (!plan.event && (plan.editions.length || !plan.unresolved.length)) {
      ctx.addIssue({
        code: "custom",
        path: ["event"],
        message: "Declined creation needs no Editions and an explanation",
      });
    }
  });
export const editorPlanSchema = z.discriminatedUnion("status", [
  readyEditorPlanSchema,
  z.strictObject({ status: z.literal("rejected"), reason }),
]);
export type EditorOutput = z.infer<typeof editorPlanSchema>;
export type EditorPlan = z.infer<typeof readyEditorPlanSchema>;
export type EventPlan = NonNullable<EditorPlan["event"]>;
export type EditionPlan = EditorPlan["editions"][number];

/** Transient plan after all accept actions have been replaced with validated sets. */
type Resolved<T> = T extends { action: "accept" }
  ? never
  : T extends readonly (infer Item)[]
    ? Resolved<Item>[]
    : T extends object
      ? { [K in keyof T]: Resolved<T[K]> }
      : T;
export type ResolvedEditorPlan = Resolved<EditorPlan>;
