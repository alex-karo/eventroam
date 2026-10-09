import {
  publicationStates,
  scopes,
  dateStates,
  scheduleStatuses,
  facets,
  linkKinds,
} from "@/catalog/domain/vocabulary";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const link = z.object({
  kind: z.enum(linkKinds),
  url: z.url(),
  label: z.string().nullable().optional(),
  official: z.boolean().optional(),
});
const occurrence = z.object({
  id: z.string(),
  occurrenceKey: z.string(),
  occurrenceYear: z.number().int().nullable().optional(),
  displayName: z.string().nullable().optional(),
  startsOn: z.string().nullable().optional(),
  endsOn: z.string().nullable().optional(),
  dateState: z.enum(dateStates).optional(),
  scheduleStatus: z.enum(scheduleStatuses).optional(),
  publicationState: z.enum(publicationStates).optional(),
  countryCode: z.string().nullable().optional(),
  locality: z.string().nullable().optional(),
  administrativeArea: z.string().nullable().optional(),
  venueName: z.string().nullable().optional(),
  venueAddress: z.string().nullable().optional(),
  termIds: z.array(z.string()).optional(),
  links: z.array(link).optional(),
});
const event = z.object({
  id: z.string(),
  slug: z.string(),
  canonicalName: z.string(),
  aliases: z.array(z.string()).optional(),
  summary: z.string().nullable().optional(),
  homeScope: z.enum(scopes).nullable().optional(),
  publicationState: z.enum(publicationStates).optional(),
  links: z.array(link).optional(),
  occurrences: z.array(occurrence),
});
const source = z.strictObject({
  attemptedUrl: z.url(),
  finalUrl: z.url(),
  retrievedAt: z.iso.datetime(),
  method: z.enum(["http", "firecrawl", "social_stub"]),
  outcome: z.enum(["ok", "partial", "unsupported", "blocked", "failed"]),
  reason: z.string().optional(),
  markdown: z.string(),
  completeness: z.enum(["full", "partial", "none"]),
});
export const assertionSchema = z.object({
  owner: z.enum(["event", "occurrence"]),
  editionKey: z.string().optional(),
  editionYear: z.number().int().optional(),
  field: z.string(),
  value: z.unknown().optional(),
  notValue: z.unknown().optional(),
  contains: z.unknown().optional(),
  containsAny: z.array(z.unknown()).min(1).optional(),
  containsText: z.string().min(1).optional(),
});
export const evalCaseSchema = z.object({
  id: z.string().min(1),
  todayUtc: z.iso.date().optional(),
  provenance: z
    .object({ kind: z.string(), sourceReport: z.string(), note: z.string() })
    .optional(),
  input: z.object({
    mode: z.enum(["add", "refresh", "check"]),
    name: z.string().optional(),
    eventId: z.string().optional(),
    actor: z.string(),
    initiatedBy: z.string(),
    dryRun: z.literal(true),
  }),
  initial: z.object({ event, relatedEvents: z.array(event).optional() }),
  sources: z.array(source),
  discoveries: z
    .array(
      z.object({
        query: z.string(),
        candidates: z.array(z.object({ url: z.url(), title: z.string() })),
      }),
    )
    .optional(),
  expectations: z
    .object({
      required: z.array(assertionSchema),
      forbidden: z.array(assertionSchema),
      research: z.object({ status: z.literal("failed") }).optional(),
    })
    .superRefine((expectations, ctx) => {
      if (expectations.research) {
        if (expectations.required.length || expectations.forbidden.length) {
          ctx.addIssue({
            code: "custom",
            message:
              "Failed research expectations cannot include change assertions",
          });
        }
      } else if (
        !expectations.required.length ||
        !expectations.forbidden.length
      ) {
        ctx.addIssue({
          code: "custom",
          message:
            "Factual research expectations need required and forbidden assertions",
        });
      }
    }),
});
export const evalSuiteSchema = z.object({
  schemaVersion: z.literal(2),
  todayUtc: z.iso.date(),
  provenance: z.object({
    kind: z.string(),
    sourceReport: z.string(),
    note: z.string().optional(),
  }),
  terms: z.array(
    z.object({
      id: z.string(),
      facet: z.enum(facets),
      slug: z.string(),
      name: z.string(),
    }),
  ),
  cases: z.array(evalCaseSchema).min(1),
});
export type EvalCase = z.infer<typeof evalCaseSchema>;
export type EvalSuite = z.infer<typeof evalSuiteSchema>;
export type EvalAssertion = z.infer<typeof assertionSchema>;

const caseFileSchema = evalCaseSchema.extend({
  sources: z.array(
    source.omit({ markdown: true }).extend({ markdownFile: z.string().min(1) }),
  ),
});
const suiteFileSchema = evalSuiteSchema.extend({
  cases: z.array(z.string().min(1)).min(1),
});

export function loadEvalSuite(
  path = fileURLToPath(new URL("./cases/suite.json", import.meta.url)),
): EvalSuite {
  const manifest = suiteFileSchema.parse(
    JSON.parse(readFileSync(path, "utf8")),
  );
  const suite = evalSuiteSchema.parse({
    ...manifest,
    cases: manifest.cases.map((casePath) => {
      const absolutePath = resolve(dirname(path), casePath);
      const item = caseFileSchema.parse(
        JSON.parse(readFileSync(absolutePath, "utf8")),
      );
      return {
        ...item,
        sources: item.sources.map(({ markdownFile, ...metadata }) => ({
          ...metadata,
          markdown: readFileSync(
            resolve(dirname(absolutePath), markdownFile),
            "utf8",
          ),
        })),
      };
    }),
  });
  const ids = suite.cases.map((item) => item.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Duplicate eval case ID");
  }
  return suite;
}
