import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const link = z.object({
  kind: z.enum([
    "official_site",
    "instagram",
    "facebook",
    "youtube",
    "tiktok",
    "ticketing",
    "other",
  ]),
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
  dateState: z.enum(["unknown", "provisional", "confirmed"]).optional(),
  scheduleStatus: z
    .enum(["announced", "scheduled", "postponed", "cancelled"])
    .optional(),
  ticketAvailability: z
    .enum(["unknown", "available", "sold_out", "closed"])
    .optional(),
  publicationState: z.enum(["draft", "published", "withdrawn"]).optional(),
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
  homeScope: z.literal("festivals").nullable().optional(),
  publicationState: z.enum(["draft", "published", "withdrawn"]).optional(),
  links: z.array(link).optional(),
  occurrences: z.array(occurrence),
});
const source = z.strictObject({
  attemptedUrl: z.url(),
  finalUrl: z.url(),
  retrievedAt: z.iso.datetime(),
  method: z.enum(["http", "social_stub"]),
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
  expectations: z.object({
    required: z.array(assertionSchema).min(1),
    forbidden: z.array(assertionSchema).min(1),
  }),
});
export const evalSuiteSchema = z.object({
  schemaVersion: z.literal(1),
  todayUtc: z.iso.date(),
  provenance: z.object({
    kind: z.string(),
    sourceReport: z.string(),
    note: z.string().optional(),
  }),
  terms: z.array(
    z.object({
      id: z.string(),
      facet: z.enum(["event_type", "format", "topic", "genre", "culture"]),
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
  if (new Set(ids).size !== ids.length)
    throw new Error("Duplicate eval case ID");
  return suite;
}
