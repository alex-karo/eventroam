import { validateCatalogValues } from "@/catalog/write/validate-values";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import { runEvals } from "@mastra/core/evals";
import { noopLogger } from "@mastra/core/logger";
import { Mastra } from "@mastra/core/mastra";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { z } from "zod";
import { openDatabase } from "@/db/connection";
import { migrateCatalogConnection } from "@/db/migrate";
import {
  events,
  externalLinks,
  occurrenceTerms,
  occurrences,
  taxonomyTerms,
} from "@/db/schema";
import { runCatalogResearch, type CatalogResearchResult } from "../workflow";
import { loadResearchConfig } from "../runtime/config";
import { createResearchBudget } from "../runtime/budget";
import { RESEARCH_PROMPT_VERSION } from "../research/contracts";
import type {
  ReadSourceResult,
  DiscoverSourcesResult,
} from "../sources/contracts";
import type { ReadSourceOptions } from "../sources/read-source";
import type { DiscoverSourcesOptions } from "../sources/discover-sources";
import { loadEvalSuite, type EvalCase, type EvalSuite } from "./fixtures";
import { sourceLinks } from "./source-links";
import { createEvalScorers, scoreCase } from "./score";

const timestamp = "2026-10-03T00:00:00.000Z";

export function seedDatabase(suite: EvalSuite, item: EvalCase) {
  const connection = openDatabase(":memory:");
  try {
    migrateCatalogConnection(connection);
    const db = drizzle(connection.client);
    db.transaction(() => {
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
        for (const edition of initial.occurrences) {
          db.insert(occurrences)
            .values(
              validateCatalogValues(connection.client, "occurrences", {
                id: edition.id,
                eventId: initial.id,
                occurrenceKey: edition.occurrenceKey,
                occurrenceYear: edition.occurrenceYear,
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
                venueName: edition.venueName,
                venueAddress: edition.venueAddress,
                createdAt: timestamp,
                updatedAt: timestamp,
              }),
            )
            .run();
          for (const termId of edition.termIds ?? []) {
            db.insert(occurrenceTerms)
              .values(
                validateCatalogValues(connection.client, "occurrence_terms", {
                  occurrenceId: edition.id,
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
                  occurrenceId: edition.id,
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

export function fixedSources(item: EvalCase, todayUtc: string) {
  const byUrl = new Map<string, ReadSourceResult>();
  for (const source of item.sources) {
    const read = {
      ...source,
      links: sourceLinks(source.markdown, source.finalUrl),
    };
    byUrl.set(new URL(source.attemptedUrl).toString(), read);
    byUrl.set(new URL(source.finalUrl).toString(), read);
  }
  return {
    readSource: async (
      url: string,
      options: ReadSourceOptions,
    ): Promise<ReadSourceResult> => {
      options.budget.consumePage(options.depth ?? 0);
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
    discoverSources: async (
      query: string,
      options: DiscoverSourcesOptions,
    ): Promise<DiscoverSourcesResult> => {
      options.budget.consumeSearch();
      return {
        query,
        candidates:
          item.discoveries?.find((discovery) => discovery.query === query)
            ?.candidates ?? [],
        retrievedAt: `${todayUtc}T00:00:00.000Z`,
        modelCostUsd: 0,
        searchCostUsd: 0,
        inputTokens: 0,
        outputTokens: 0,
      };
    },
  };
}

export type EvalOptions = {
  caseIds?: string[];
  model?: string;
  repeat?: number;
  reportPath?: string;
  suite?: EvalSuite;
};

export async function runCatalogEvals(options: EvalOptions = {}) {
  const suite = options.suite ?? loadEvalSuite();
  const selected = suite.cases.filter(
    (item) => !options.caseIds?.length || options.caseIds.includes(item.id),
  );
  if (
    !selected.length ||
    options.caseIds?.some((id) => !suite.cases.some((item) => item.id === id))
  ) {
    throw new Error("Unknown or empty eval case selection");
  }
  const repeat = options.repeat ?? 1;
  if (!Number.isSafeInteger(repeat) || repeat < 1 || repeat > 20) {
    throw new Error("repeat must be 1–20");
  }
  if (options.reportPath && existsSync(options.reportPath)) {
    throw new Error(`Eval report already exists: ${options.reportPath}`);
  }
  const config = loadResearchConfig({
    ...process.env,
    ...(options.model ? { OPENROUTER_MODEL: options.model } : {}),
  });
  const scorer = createEvalScorers(selected);
  const byId = new Map(selected.map((item) => [item.id, item]));
  const outputs = new Map<string, CatalogResearchResult>();
  const inputSchema = z.object({
    caseId: z.string(),
    repetition: z.number().int().positive(),
  });
  const step = createStep({
    id: "evaluate-catalog-case",
    inputSchema,
    outputSchema: z.custom<CatalogResearchResult>(),
    execute: async ({ inputData }) => {
      const item = byId.get(inputData.caseId);
      if (!item) {
        throw new Error(`Unknown eval case: ${inputData.caseId}`);
      }
      const connection = seedDatabase(suite, item);
      try {
        let result: CatalogResearchResult;
        const started = Date.now();
        try {
          result = await runCatalogResearch(item.input, {
            client: connection.client,
            config,
            todayUtc: item.todayUtc ?? suite.todayUtc,
            ...fixedSources(item, item.todayUtc ?? suite.todayUtc),
          });
        } catch {
          result = {
            schemaVersion: 2,
            mode: item.input.mode,
            outcome: "failed",
            researchStatus: "failed",
            eventId: item.input.eventId,
            modelResponse: null,
            operations: [],
            receipts: [],
            references: {},
            changes: [],
            sources: [],
            sourceSummaries: [],
            errors: [
              {
                code: "model_failed",
                message: "Evaluation workflow failed",
                stage: "research",
              },
            ],
            unresolved: [],
            eventNameMismatch: null,
            usage: {
              ...createResearchBudget(config.limits).snapshot(),
              complete: false,
              inputTokens: 0,
              outputTokens: 0,
              cachedInputTokens: null,
              reasoningTokens: null,
              modelCostUsd: null,
              searchCostUsd: 0,
            },
            modelVersion: config.model,
            reasoningEffort: config.reasoningEffort ?? null,
            promptVersion: RESEARCH_PROMPT_VERSION,
            durationMs: Date.now() - started,
          };
        }
        outputs.set(`${inputData.caseId}/${inputData.repetition}`, result);
        return result;
      } finally {
        connection.client.close();
      }
    },
  });
  const workflow = createWorkflow({
    id: "catalog-eval",
    inputSchema,
    outputSchema: z.custom<CatalogResearchResult>(),
  })
    .then(step)
    .commit();
  workflow.__setLogger(noopLogger);
  // Register the eval target so runEvals scores the workflow result in Mastra.
  const mastra = new Mastra({
    workflows: { catalogEval: workflow },
    logger: false,
  });
  const data = selected.flatMap((item) =>
    Array.from({ length: repeat }, (_, index) => ({
      input: { caseId: item.id, repetition: index + 1 },
    })),
  );
  const startedAt = new Date().toISOString();
  const mastraResult = await runEvals({
    target: mastra.getWorkflow("catalogEval"),
    data,
    scorers: [scorer.correctness, scorer.completeness],
    concurrency: 3,
  });
  const results = data.map(({ input }) => {
    const item = byId.get(input.caseId)!;
    const result = outputs.get(`${input.caseId}/${input.repetition}`);
    if (!result) {
      throw new Error(
        `Eval workflow did not return ${input.caseId}/${input.repetition}`,
      );
    }
    return {
      caseId: input.caseId,
      repetition: input.repetition,
      fixtureTodayUtc: item.todayUtc ?? suite.todayUtc,
      fixtureProvenance: item.provenance ?? suite.provenance,
      outcome: result.outcome,
      researchStatus: result.researchStatus,
      score: scoreCase(item, result),
      usage: result.usage,
      durationMs: result.durationMs,
      modelVersion: result.modelVersion,
      reasoningEffort: result.reasoningEffort ?? null,
      promptVersion: result.promptVersion,
      modelResponse: result.modelResponse ?? null,
      operations: result.operations,
      references: result.references,
      changes: result.changes,
      errors: result.errors,
      unresolved: result.unresolved,
      sources: result.sources,
      sourceSummaries: result.sourceSummaries,
      eventNameMismatch: result.eventNameMismatch,
    };
  });
  const report = {
    schemaVersion: 2,
    startedAt,
    finishedAt: new Date().toISOString(),
    fixtureTodayUtc: suite.todayUtc,
    fixtureSha256: createHash("sha256")
      .update(JSON.stringify(suite))
      .digest("hex"),
    fixtureProvenance: suite.provenance,
    modelVersion: config.model,
    reasoningEffort: config.reasoningEffort ?? null,
    promptVersion: RESEARCH_PROMPT_VERSION,
    mastra: {
      scores: mastraResult.scores,
      summary: mastraResult.summary,
      verdict: mastraResult.verdict,
    },
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
