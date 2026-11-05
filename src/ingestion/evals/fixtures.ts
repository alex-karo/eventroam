import { addInputSchema } from "../add-input";
import { assertMainCase } from "./main";
import { assertRegressionCase } from "./regression";
import { assertLocationCase } from "./location";
import { roleHandoffSchema, assertEditorFixture } from "./editor-fixture";
import { locationInputSchema } from "../location/input";
import {
  geocodingRequestSchema,
  geocodingResultSchema,
} from "../tools/geocode/contracts";
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
import { catalogPriceBlockSchema } from "@/catalog/operations/operation";
import { wackenAddCase } from "./cases/wacken/add";

const link = z.object({
  kind: z.enum(linkKinds),
  url: z.url(),
  label: z.string().nullable().optional(),
  official: z.boolean().optional(),
});
const edition = z.object({
  id: z.string(),
  editionKey: z.string(),
  editionYear: z.number().int().nullable().optional(),
  displayName: z.string().nullable().optional(),
  startsOn: z.string().nullable().optional(),
  endsOn: z.string().nullable().optional(),
  dateState: z.enum(dateStates).optional(),
  scheduleStatus: z.enum(scheduleStatuses).optional(),
  publicationState: z.enum(publicationStates).optional(),
  countryCode: z.string().nullable().optional(),
  locality: z.string().nullable().optional(),
  administrativeArea: z.string().nullable().optional(),
  timeZone: z.string().nullable().optional(),
  sizeEstimate: z.number().int().positive().nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  coordinatePrecision: z
    .enum(["unknown", "exact", "approximate", "locality", "region"])
    .optional(),
  venueName: z.string().nullable().optional(),
  venueAddress: z.string().nullable().optional(),
  termIds: z.array(z.string()).optional(),
  tickets: catalogPriceBlockSchema.optional(),
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
  editions: z.array(edition),
});
const source = z.strictObject({
  attemptedUrl: z.url(),
  finalUrl: z.url(),
  retrievedAt: z.iso.datetime(),
  method: z.enum(["http", "firecrawl", "social_stub"]),
  status: z.enum(["ok", "unsupported", "failed"]),
  reasonCode: z.string().optional(),
  markdown: z.string(),
});
const commonCaseSchema = z.strictObject({
  id: z.string().min(1),
  origin: z.enum(["captured", "synthetic"]),
  task: z.string().min(1),
  roleHandoff: roleHandoffSchema.optional(),
  geocoding: z
    .array(
      z.strictObject({
        request: geocodingRequestSchema,
        response: geocodingResultSchema,
        provenance: z.string().min(1).optional(),
      }),
    )
    .optional(),
  location: z
    .strictObject({
      group: z.enum(["completion", "correction", "preservation"]),
      input: locationInputSchema,
    })
    .optional(),
  todayUtc: z.iso.date().optional(),
  provenance: z.object({ kind: z.string(), note: z.string() }).optional(),
  input: z.object({
    mode: z.enum(["add", "refresh"]),
    scope: z.enum(["full", "current"]).optional(),
    input: addInputSchema.optional(),
    eventId: z.string().optional(),
    actor: z.string(),
    initiatedBy: z.string(),
    dryRun: z.literal(true),
  }),
  discoveries: z
    .array(
      z.object({
        queryPattern: z.string(),
        candidates: z.array(
          z.object({
            url: z.url(),
            title: z.string(),
            highlights: z.array(z.string().min(1).max(2000)).max(1),
          }),
        ),
      }),
    )
    .optional(),
});
const initialSchema = z.object({
  event,
  relatedEvents: z.array(event).optional(),
});
const pipelineCaseFields = {
  location: z.undefined().optional(),
  initial: initialSchema,
  sources: z.array(source),
};
const mainPipelineEvalCaseSchema = commonCaseSchema.extend({
  ...pipelineCaseFields,
  suite: z.literal("main"),
});
const regressionPipelineEvalCaseSchema = commonCaseSchema.extend({
  ...pipelineCaseFields,
  suite: z.literal("regression"),
});
const pipelineEvalCaseSchema = z.discriminatedUnion("suite", [
  mainPipelineEvalCaseSchema,
  regressionPipelineEvalCaseSchema,
]);
const locationEvalCaseSchema = commonCaseSchema.extend({
  suite: z.literal("regression"),
  location: commonCaseSchema.shape.location.unwrap(),
  // Only workflow integration cases need a separate catalog seed.
  initial: initialSchema.optional(),
  sources: z.array(source).default([]),
});
const evalCaseSchema = z.union([
  pipelineEvalCaseSchema,
  locationEvalCaseSchema,
]);
const evalSuiteSchema = z.object({
  schemaVersion: z.literal(2),
  todayUtc: z.iso.date(),
  provenance: z.object({
    kind: z.string(),
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
export type PipelineEvalCase = z.infer<typeof pipelineEvalCaseSchema>;
export type RegressionPipelineEvalCase = z.infer<
  typeof regressionPipelineEvalCaseSchema
>;
export type LocationEvalCase = z.infer<typeof locationEvalCaseSchema>;
export type EvalSuite = z.infer<typeof evalSuiteSchema>;

const sourceFilesSchema = z.array(
  source.omit({ markdown: true }).extend({ markdownFile: z.string().min(1) }),
);
const handoffFileSchema = z.string().min(1).optional();
const caseFileSchema = z.union([
  mainPipelineEvalCaseSchema.extend({
    roleHandoffFile: handoffFileSchema,
    sources: sourceFilesSchema,
  }),
  regressionPipelineEvalCaseSchema.extend({
    roleHandoffFile: handoffFileSchema,
    sources: sourceFilesSchema,
  }),
  locationEvalCaseSchema.extend({
    roleHandoffFile: handoffFileSchema,
    sources: sourceFilesSchema.default([]),
  }),
]);
const suiteFileSchema = evalSuiteSchema.extend({
  cases: z.array(z.string().min(1)).min(1),
});

export function loadEvalSuite(): EvalSuite {
  const path = fileURLToPath(new URL("./cases/suite.json", import.meta.url));
  const manifest = suiteFileSchema.parse(
    JSON.parse(readFileSync(path, "utf8")),
  );
  const suite = evalSuiteSchema.parse({
    ...manifest,
    cases: manifest.cases.map((casePath) => {
      const absolutePath = resolve(dirname(path), casePath);
      const { roleHandoffFile, ...item } = caseFileSchema.parse(
        JSON.parse(readFileSync(absolutePath, "utf8")),
      );
      return {
        ...item,
        roleHandoff: roleHandoffFile
          ? roleHandoffSchema.parse(
              JSON.parse(
                readFileSync(
                  resolve(dirname(absolutePath), roleHandoffFile),
                  "utf8",
                ),
              ),
            )
          : undefined,
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
  suite.cases.push(evalCaseSchema.parse(wackenAddCase(suite.cases)));
  const ids = suite.cases.map((item) => item.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Duplicate eval case ID");
  }
  for (const item of suite.cases) {
    if (item.suite === "main") {
      assertMainCase(item);
    } else if (item.location) {
      assertLocationCase(item);
    } else {
      assertRegressionCase(item);
      assertEditorFixture(item);
    }
  }
  return suite;
}
