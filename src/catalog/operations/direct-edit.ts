import { z } from "zod";
import { normalizeCatalogUrl } from "@/catalog/domain/urls";
import {
  catalogPriceBlockSchema,
  editionUpdateSchema,
  eventUpdateSchema,
  linkValueSchema,
  termIdsSchema,
} from "./operation";

function editFields<T extends z.ZodRawShape>(shape: T) {
  const fields = Object.entries(shape).map(([name, schema]) => [
    name,
    z.strictObject({ before: z.json(), after: schema }).optional(),
  ]);
  return z.strictObject(
    Object.fromEntries(fields) as {
      [K in keyof T]: z.ZodOptional<
        z.ZodObject<{ before: z.ZodJSONSchema; after: T[K] }>
      >;
    },
  );
}

const id = z.string().min(1).max(200);
const linkEdit = z
  .strictObject({
    id,
    changes: editFields(linkValueSchema.required().shape),
  })
  .superRefine(({ changes }, context) => {
    if (!Object.keys(changes).length) {
      context.addIssue({
        code: "custom",
        message: "Each link needs at least one edit",
      });
    }
    const url = changes.url?.after;
    if (url && URL.canParse(url) && normalizeCatalogUrl(url) !== url) {
      context.addIssue({
        code: "custom",
        message: "Use the normalized link URL",
      });
    }
  });
const target = {
  id,
  links: z
    .array(linkEdit)
    .min(
      1,
      "To keep links unchanged, omit links or use null. Do not use an empty list.",
    )
    .max(30)
    .refine(
      (links) => new Set(links.map(({ id }) => id)).size === links.length,
      "Include each link only once",
    )
    .nullish()
    .describe(
      "Optional edits to existing links owned by this target. Omit or use null to keep all links unchanged. Field edits do not need links. These are link changes, not source references.",
    ),
};
const editTargetSchema = z
  .discriminatedUnion("kind", [
    z.strictObject({
      ...target,
      kind: z.literal("event"),
      changes: editFields(eventUpdateSchema.required().shape),
    }),
    z.strictObject({
      ...target,
      kind: z.literal("edition"),
      changes: editFields({
        ...editionUpdateSchema.required().shape,
        price: catalogPriceBlockSchema,
        termIds: termIdsSchema,
      }),
    }),
  ])
  .superRefine((target, context) => {
    if (!Object.keys(target.changes).length && !target.links) {
      context.addIssue({
        code: "custom",
        message: "Each target needs at least one edit",
      });
    }
    if (target.kind === "edition") {
      const terms = target.changes.termIds?.after;
      if (terms && new Set(terms).size !== terms.length) {
        context.addIssue({ code: "custom", message: "Use distinct term IDs" });
      }
      for (const { url } of target.changes.price?.after.priceDetails ?? []) {
        if (url && URL.canParse(url) && normalizeCatalogUrl(url) !== url) {
          context.addIssue({
            code: "custom",
            message: "Use normalized price detail URLs",
          });
        }
      }
    }
  });

export const catalogEditSchema = z.strictObject({
  auditMode: z.enum(["record", "omit"]),
  targets: z
    .array(editTargetSchema)
    .min(1)
    .max(200)
    .refine(
      (targets) =>
        new Set(targets.map(({ kind, id }) => `${kind}:${id}`)).size ===
        targets.length,
      "Include each Event or Edition only once",
    ),
});

export type CatalogEdit = z.output<typeof catalogEditSchema>;
export type CatalogEditTarget = z.output<typeof editTargetSchema>;
