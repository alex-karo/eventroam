import { createWorkflowStorage } from "../runtime/workflow-storage";
import { resolveLocation, type LocationExecution } from "../location/agent";
import { LOCATION_PROMPT_VERSION } from "../location/contracts";
import { createResearchBudget } from "../runtime/budget";
import {
  createRunObservability,
  finishRunObservability,
} from "../runtime/observability/runtime";
import { geocodingKey, type GeocodingClient } from "../tools/geocode/contracts";
import { scoreLocationCase } from "./score";
import { validateCatalogValues } from "@/catalog/write/validate-values";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { dirname } from "node:path";
import { runExperiment } from "@mastra/core/datasets";
import { Mastra } from "@mastra/core/mastra";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { openDatabase } from "@/db/connection";
import { migrateCatalogConnection } from "@/db/migrate";
import {
  events,
  externalLinks,
  editionTerms,
  editions,
  taxonomyTerms,
} from "@/db/schema";
import { RunPersistenceError, persistenceFailureReport } from "../runs";
import { runCatalogResearch, type CatalogResearchResult } from "../workflow";
import { loadResearchConfig } from "../runtime/config";
import { RESEARCH_PROMPT_VERSION } from "../research/contracts";
import type { ReadPageResult } from "../tools/read-page/contracts";
import type { SearchWebResult } from "../tools/search-web/contracts";
import type { ReadPageOptions } from "../tools/read-page/read";
import type { SearchWebOptions } from "../tools/search-web/search";
import {
  loadEvalSuite,
  type EvalCase,
  type PipelineEvalCase,
  type EvalSuite,
} from "./fixtures";
import { sourceLinks } from "./source-links";
import { scoreCase, type CaseScore } from "./score";
import { createEvalScorers } from "./scorers";

import type { EvalToolCall } from "./tool-use";

const timestamp = "2026-10-03T00:00:00.000Z";

function ticketColumns(
  tickets: PipelineEvalCase["initial"]["event"]["editions"][number]["tickets"],
) {
  const base = tickets?.basePrice;
  return {
    priceDetails: tickets?.priceDetails,
    priceKind: base?.kind,
    priceCurrency: base && "currency" in base ? base.currency : null,
    priceMinMinor: base?.minMinor,
    priceMaxMinor: base?.maxMinor,
    priceCoverage: base?.coverage,
    priceQualification: base?.qualification,
  };
}

export function seedDatabase(suite: EvalSuite, item: PipelineEvalCase) {
  const connection = openDatabase(":memory:");
  try {
    migrateCatalogConnection(connection);
    const db = drizzle(connection.client);
    db.transaction(() => {
      db.delete(taxonomyTerms).run();
      for (const term of suite.terms) {
        db.insert(taxonomyTerms)
          .values(
            validateCatalogValues(connection.client, "taxonomy_terms", term),
          )
          .run();
      }
      for (const initial of [
        item.initial.event,
        ...(item.initial.relatedEvents ?? []),
      ]) {
        db.insert(events)
          .values(
            validateCatalogValues(connection.client, "events", {
              id: initial.id,
              slug: initial.slug,
              canonicalName: initial.canonicalName,
              aliases: initial.aliases ?? [],
              summary: initial.summary,
              homeScope: initial.homeScope,
              publicationState: initial.publicationState ?? "draft",
              createdAt: timestamp,
              updatedAt: timestamp,
            }),
          )
          .run();
        for (const link of initial.links ?? []) {
          db.insert(externalLinks)
            .values(
              validateCatalogValues(connection.client, "external_links", {
                id: `eval-link-${initial.id}-${link.kind}-${link.url}`,
                eventId: initial.id,
                kind: link.kind,
                url: link.url,
                label: link.label,
                official: link.official ?? false,
                createdAt: timestamp,
                updatedAt: timestamp,
              }),
            )
            .run();
        }
        for (const edition of initial.editions) {
          db.insert(editions)
            .values(
              validateCatalogValues(connection.client, "editions", {
                id: edition.id,
                eventId: initial.id,
                editionKey: edition.editionKey,
                editionYear: edition.editionYear,
                displayName: edition.displayName,
                startsOn: edition.startsOn,
                endsOn: edition.endsOn,
                dateState:
                  edition.dateState ??
                  (edition.startsOn ? "confirmed" : "unknown"),
                scheduleStatus:
                  edition.scheduleStatus ??
                  (edition.startsOn ? "scheduled" : "announced"),
                publicationState: edition.publicationState ?? "draft",
                countryCode: edition.countryCode,
                locality: edition.locality,
                administrativeArea: edition.administrativeArea,
                timeZone: edition.timeZone,
                sizeEstimate: edition.sizeEstimate,
                venueName: edition.venueName,
                venueAddress: edition.venueAddress,
                latitude: edition.latitude,
                longitude: edition.longitude,
                coordinatePrecision: edition.coordinatePrecision,
                ...ticketColumns(edition.tickets),
                createdAt: timestamp,
                updatedAt: timestamp,
              }),
            )
            .run();
          for (const termId of edition.termIds ?? []) {
            db.insert(editionTerms)
              .values(
                validateCatalogValues(connection.client, "edition_terms", {
                  editionId: edition.id,
                  termId,
                }),
              )
              .run();
          }
          for (const link of edition.links ?? []) {
            db.insert(externalLinks)
              .values(
                validateCatalogValues(connection.client, "external_links", {
                  id: `eval-link-${edition.id}-${link.kind}-${link.url}`,
                  editionId: edition.id,
                  kind: link.kind,
                  url: link.url,
                  label: link.label,
                  official: link.official ?? false,
                  createdAt: timestamp,
                  updatedAt: timestamp,
                }),
              )
              .run();
          }
        }
      }
    });
    return connection;
  } catch (error) {
    connection.client.close();
    throw error;
  }
}

export function fixedSources(
  item: PipelineEvalCase,
  todayUtc: string,
  calls: EvalToolCall[] = [],
) {
  const byUrl = new Map<string, ReadPageResult>();
  for (const source of item.sources) {
    const read = {
      ...source,
      links: sourceLinks(source.markdown, source.finalUrl),
    };
    byUrl.set(new URL(source.attemptedUrl).toString(), read);
    byUrl.set(new URL(source.finalUrl).toString(), read);
  }
  return {
    readPage: async (
      url: string,
      options: ReadPageOptions,
    ): Promise<ReadPageResult> => {
      calls.push({ tool: "readPage", url });
      options.budget.consumePage();
      const source = byUrl.get(new URL(url).toString());
      return source
        ? structuredClone(source)
        : {
            attemptedUrl: url,
            finalUrl: url,
            retrievedAt: `${todayUtc}T00:00:00.000Z`,
            method: "http",
            outcome: "blocked",
            reason: "not_in_eval_fixture",
            markdown: "",
            links: [],
            completeness: "none",
          };
    },
    searchWeb: async (
      query: string,
      options: SearchWebOptions,
    ): Promise<SearchWebResult> => {
      calls.push({ tool: "searchWeb", query });
      options.budget.consumeSearch();
      return {
        query,
        candidates:
          item.discoveries?.find((discovery) =>
            new RegExp(discovery.queryPattern, "i").test(query),
          )?.candidates ?? [],
        retrievedAt: `${todayUtc}T00:00:00.000Z`,
      };
    },
  };
}

export type EvalOptions = {
  editorOnly?: boolean;
  locationOnly?: boolean;
  caseIds?: string[];
  model?: string;
  repeat?: number;
  reportPath?: string;
  suite?: EvalSuite;
};

export type EvalCaseOutput = {
  report?: CatalogResearchResult;
  location?: LocationExecution;
  runId?: string;
  traceId?: string;
  toolCalls: EvalToolCall[];
  score: CaseScore;
};

function evaluationConfig(options: EvalOptions) {
  const env = { ...process.env };
  if (options.model) {
    env.OPENROUTER_MODEL = options.model;
    if (options.locationOnly) {
      env.CATALOG_LOCATION_MODEL = options.model;
    }
  }
  return loadResearchConfig(env);
}

export async function runCatalogEvals(options: EvalOptions = {}) {
  if (options.editorOnly && options.locationOnly) {
    throw new Error("--location-only and --editor-only are mutually exclusive");
  }
  const suite = options.suite ?? loadEvalSuite();
  const selected = suite.cases.filter((item) => {
    if (options.caseIds?.length) {
      return options.caseIds.includes(item.id);
    }
    if (options.locationOnly) {
      return !!item.location;
    }
    return (
      !item.location &&
      Boolean(options.editorOnly) === Boolean(item.researchHandoff)
    );
  });
  if (
    !selected.length ||
    options.caseIds?.some((id) => !suite.cases.some((item) => item.id === id))
  ) {
    throw new Error("Unknown or empty eval case selection");
  }
  if (options.locationOnly && selected.some((item) => !item.location)) {
    throw new Error("Location-only eval requires a complete Location fixture");
  }
  if (!options.locationOnly && selected.some((item) => item.location)) {
    throw new Error("Location fixtures require --location-only");
  }
  if (options.editorOnly && selected.some((item) => !item.researchHandoff)) {
    throw new Error(
      "Editor-only eval requires a research handoff for every selected case",
    );
  }
  if (!options.editorOnly && selected.some((item) => item.researchHandoff)) {
    throw new Error(
      "Pipeline eval does not accept research handoffs; use --editor-only",
    );
  }
  const repeat = options.repeat ?? 1;
  if (!Number.isSafeInteger(repeat) || repeat < 1 || repeat > 20) {
    throw new Error("repeat must be 1–20");
  }
  if (options.reportPath && existsSync(options.reportPath)) {
    throw new Error(`Eval report already exists: ${options.reportPath}`);
  }
  const config = evaluationConfig(options);
  const scorers = Object.values(createEvalScorers());
  const byId = new Map(selected.map((item) => [item.id, item]));
  const data = selected.flatMap((item) =>
    Array.from({ length: repeat }, (_, index) => ({
      id: `${item.id}/${index + 1}`,
      input: { caseId: item.id, repetition: index + 1 },
    })),
  );
  const experiment = await runExperiment(new Mastra({ logger: false }), {
    data,
    scorers,
    maxConcurrency: 3,
    persistence: { experiments: "none", scores: "none" },
    task: async ({ input }): Promise<EvalCaseOutput> => {
      // These inputs come from the selected fixtures above.
      const { caseId } = input as (typeof data)[number]["input"];
      const item = byId.get(caseId)!;
      const calls: EvalToolCall[] = [];
      if (item.location) {
        const runId = `location-eval-${randomUUID()}`;
        const tracing = await createRunObservability(
          item.input,
          config.locationModel ?? config.model,
          runId,
          options.reportPath ? [options.reportPath] : [],
        );
        try {
          const location = await resolveLocation(
            item.location.input,
            createResearchBudget(config.limits),
            config,
            { geocodingClient: fixedGeocoding(item) },
            tracing,
          );
          return {
            location,
            runId,
            ...(tracing?.root?.traceId
              ? { traceId: tracing.root.traceId }
              : {}),
            toolCalls: location.observations
              .filter((observation) => observation.origin === "agent")
              .map((observation) => ({
                tool: "geocode" as const,
                observation,
              })),
            score: scoreLocationCase(item, location),
          };
        } finally {
          await finishRunObservability(tracing);
        }
      }
      const connection = seedDatabase(suite, item);
      const workflowStorage = createWorkflowStorage({ path: ":memory:" });
      try {
        let result: CatalogResearchResult;
        try {
          result = await runCatalogResearch(item.input, {
            client: connection.client,
            workflowStorage,
            config,
            reportPath: options.reportPath,
            todayUtc: item.todayUtc ?? suite.todayUtc,
            geocodingClient: fixedGeocoding(item),
            ...fixedSources(item, item.todayUtc ?? suite.todayUtc, calls),
            ...(options.editorOnly
              ? {
                  generateCandidate: async () =>
                    structuredClone(item.researchHandoff!.candidate),
                }
              : {}),
          });
        } catch (error) {
          const available =
            error instanceof RunPersistenceError
              ? persistenceFailureReport(error)
              : undefined;
          if (!available) {
            throw new Error("Evaluation task failed");
          }
          result = available;
        }
        return {
          report: result,
          toolCalls: calls,
          score: scoreCase(item, result, calls),
        };
      } finally {
        await workflowStorage.close();
        connection.client.close();
      }
    },
  });
  const { results: attempts, ...experimentSummary } = experiment;
  if (attempts.length !== data.length) {
    throw new Error("Eval experiment did not return every case");
  }
  // Mastra keeps results in input order even when tasks finish out of order.
  const results = attempts.map((attempt, index) => {
    const { input } = data[index];
    const item = byId.get(input.caseId)!;
    return {
      ...attempt,
      output: (attempt.output ?? null) as EvalCaseOutput | null,
      error: attempt.error ? { message: "Evaluation task failed" } : null,
      scores: attempt.scores.map((score) => ({
        ...score,
        error: score.error
          ? { message: "Evaluation scorer failed" }
          : undefined,
      })),
      group: item.location?.group ?? null,
      caseId: input.caseId,
      repetition: input.repetition,
      fixtureTodayUtc: item.todayUtc ?? suite.todayUtc,
      fixtureProvenance: item.provenance ?? suite.provenance,
      researchHandoff: options.editorOnly
        ? {
            provenance: item.researchHandoff!.provenance,
            sha256: createHash("sha256")
              .update(JSON.stringify(item.researchHandoff))
              .digest("hex"),
          }
        : null,
    };
  });
  let evaluationMode = "pipeline";
  if (options.editorOnly) {
    evaluationMode = "editor-only";
  }
  if (options.locationOnly) {
    evaluationMode = "location-only";
  }
  const report = {
    schemaVersion: 7,
    evaluationMode,
    startedAt: experiment.startedAt.toISOString(),
    finishedAt: experiment.completedAt.toISOString(),
    fixtureTodayUtc: suite.todayUtc,
    fixtureSha256: createHash("sha256")
      .update(JSON.stringify(suite))
      .digest("hex"),
    fixtureProvenance: suite.provenance,
    modelVersion: options.locationOnly ? config.locationModel : config.model,
    locationModelVersion: config.locationModel ?? config.model,
    locationPromptVersion: LOCATION_PROMPT_VERSION,
    reasoningEffort: config.reasoningEffort ?? null,
    promptVersion: options.locationOnly
      ? LOCATION_PROMPT_VERSION
      : RESEARCH_PROMPT_VERSION,
    experiment: experimentSummary,
    results,
  };
  if (options.reportPath) {
    mkdirSync(dirname(options.reportPath), { recursive: true });
    writeFileSync(options.reportPath, `${JSON.stringify(report, null, 2)}\n`, {
      flag: "wx",
      mode: 0o600,
    });
  }
  return report;
}

export function evalItemPassed(item: {
  error?: unknown;
  output?: unknown;
  scores: { scorerId: string; score: number | null; error?: unknown }[];
}) {
  const output = item.output as EvalCaseOutput | null;
  const required = Object.values(createEvalScorers()).map(
    (scorer) => scorer.id,
  );
  return (
    !item.error &&
    !!output?.score.passed &&
    required.every((id) =>
      item.scores.some(
        (score) =>
          score.scorerId === id && !score.error && score.score !== null,
      ),
    )
  );
}

export function fixedGeocoding(item: EvalCase): GeocodingClient {
  return async (request) =>
    item.geocoding?.find(
      (fixture) => geocodingKey(fixture.request) === geocodingKey(request),
    )?.response ?? { status: "error", code: "fixture_miss" };
}
