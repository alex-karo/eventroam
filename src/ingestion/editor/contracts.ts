import { z } from "zod";
import {
  researchDataSchema,
  researchQuestionSchema,
} from "../research/contracts";

export const EDITOR_PROMPT_VERSION = "catalog-editor-v1";
const reason = z.string().trim().min(1).max(500);
const keep = z.strictObject({ action: z.literal("keep"), reason });
const clear = z.strictObject({ action: z.literal("clear"), reason });
function action<T extends z.ZodType>(value: T) {
  return z.discriminatedUnion("action", [
    z.strictObject({ action: z.literal("set"), value, reason }),
    keep,
  ]);
}
function clearable<T extends z.ZodType>(value: T) {
  return z.discriminatedUnion("action", [
    z.strictObject({ action: z.literal("set"), value, reason }),
    keep,
    clear,
  ]);
}
const facts = researchDataSchema.shape.editions.element.shape;
const text = (max: number) => z.string().trim().min(1).max(max);
const link = clearable(z.url().refine((url) => /^https?:\/\//.test(url)));
const eventFields = z.strictObject({
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
const editionFields = z.strictObject({
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
    z
      .array(z.string().min(1))
      .max(50)
      .refine((ids) => new Set(ids).size === ids.length),
  ).optional(),
  links: z.strictObject({ tickets: link.optional() }).optional(),
});
export const editorPlanSchema = z
  .strictObject({
    event: z
      .strictObject({
        target: z.union([
          z.strictObject({ eventId: z.string().min(1) }),
          z.strictObject({
            create: z.strictObject({ canonicalName: text(250) }),
            reason,
          }),
        ]),
        fields: eventFields,
      })
      .nullable(),
    editions: z
      .array(
        z.strictObject({
          target: z.union([
            z.strictObject({ editionKey: facts.key }),
            z.strictObject({
              create: z.strictObject({ editionKey: facts.key }),
              reason,
            }),
          ]),
          fields: editionFields,
        }),
      )
      .max(20),
    unresolved: z.array(researchQuestionSchema).max(30),
  })
  .superRefine((plan, ctx) => {
    const keys = plan.editions.map((edition) =>
      "editionKey" in edition.target
        ? edition.target.editionKey
        : edition.target.create.editionKey,
    );
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
export type EditorPlan = z.infer<typeof editorPlanSchema>;
export type EventPlan = NonNullable<EditorPlan["event"]>;
export type EditionPlan = EditorPlan["editions"][number];
