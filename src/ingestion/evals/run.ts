import { validateCatalogValues } from "@/catalog/write/validate-values";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
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
import { createResearchBudget } from "../runtime/budget";
import { EDITOR_PROMPT_VERSION } from "../editor/contracts";
import { RESEARCH_PROMPT_VERSION } from "../research/contracts";
import type { ReadPageResult } from "../tools/read-page/contracts";
import type { SearchWebResult } from "../tools/search-web/contracts";
import type { ReadPageOptions } from "../tools/read-page/read";
import type { SearchWebOptions } from "../tools/search-web/search";
import { loadEvalSuite, type EvalCase, type EvalSuite } from "./fixtures";
import { sourceLinks } from "./source-links";
import { scoreCase, type CaseScore } from "./score";
import { createEvalScorers } from "./scorers";

import type { EvalToolCall } from "./tool-use";

const timestamp = "2026-10-03T00:00:00.000Z";

function ticketColumns(
  tickets: EvalCase["initial"]["event"]["editions"][number]["tickets"],
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
  item: EvalCase,
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
        modelCostUsd: 0,
        searchCostUsd: 0,
        inputTokens: 0,
        outputTokens: 0,
      };
    },
  };
}

export type EvalOptions = {
  editorOnly?: boolean;
  caseIds?: string[];
  model?: string;
  repeat?: number;
  reportPath?: string;
  suite?: EvalSuite;
};

type EvalCaseOutput = {
  result: CatalogResearchResult;
  toolCalls: EvalToolCall[];
  score: CaseScore;
};

export async function runCatalogEvals(options: EvalOptions = {}) {
  const suite = options.suite ?? loadEvalSuite();
  const selected = suite.cases.filter((item) =>
    options.caseIds?.length
      ? options.caseIds.includes(item.id)
      : Boolean(options.editorOnly) === Boolean(item.researchHandoff),
  );
  if (
    !selected.length ||
    options.caseIds?.some((id) => !suite.cases.some((item) => item.id === id))
  ) {
    throw new Error("Unknown or empty eval case selection");
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
  const config = loadResearchConfig({
    ...process.env,
    ...(options.model ? { OPENROUTER_MODEL: options.model } : {}),
  });
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
      const connection = seedDatabase(suite, item);
      try {
        let result: CatalogResearchResult;
        const started = Date.now();
        try {
          result = await runCatalogResearch(item.input, {
            client: connection.client,
            config,
            todayUtc: item.todayUtc ?? suite.todayUtc,
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
          result = available ?? {
            schemaVersion: 5,
            editorResponse: null,
            editorStatus: "not_run",
            editorPromptVersion: EDITOR_PROMPT_VERSION,
            scope:
              item.input.mode === "refresh"
                ? (item.input.scope ?? "full")
                : null,
            currentDate: null,
            limits: config.limits,
            workload: {
              savedEditions: 0,
              returnedEditions: 0,
            },
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
              searchCostBasis: "estimate",
            },
            modelVersion: config.model,
            reasoningEffort: config.reasoningEffort ?? null,
            promptVersion: RESEARCH_PROMPT_VERSION,
            durationMs: Date.now() - started,
          };
        }
        return {
          result,
          toolCalls: calls,
          score: scoreCase(item, result, calls),
        };
      } finally {
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
    if (attempt.itemId !== data[index].id || attempt.error || !attempt.output) {
      throw new Error(`Eval task did not return ${data[index].id}`);
    }
    if (
      attempt.scores.length !== scorers.length ||
      attempt.scores.some((scorer) => scorer.error || scorer.score === null)
    ) {
      throw new Error(`Eval scorer failed for ${data[index].id}`);
    }
    const item = byId.get(input.caseId)!;
    const { result, score, toolCalls } = attempt.output as EvalCaseOutput;
    return {
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
      runId: result.runId,
      outcome: result.outcome,
      researchStatus: result.researchStatus,
      score,
      scorers: attempt.scores,
      toolCalls,
      usage: result.usage,
      durationMs: result.durationMs,
      modelVersion: result.modelVersion,
      reasoningEffort: result.reasoningEffort ?? null,
      promptVersion: result.promptVersion,
      modelResponse: result.modelResponse ?? null,
      editorResponse: result.editorResponse,
      editorStatus: result.editorStatus,
      editorPromptVersion: result.editorPromptVersion,
      operations: result.operations,
      references: result.references,
      changes: result.changes,
      errors: result.errors,
      unresolved: result.unresolved,
      sources: result.sources,
      sourceSummaries: result.sourceSummaries,
      eventNameMismatch: result.eventNameMismatch,
      scope: result.scope,
      currentDate: result.currentDate,
      limits: result.limits,
      workload: result.workload,
    };
  });
  const report = {
    schemaVersion: 5,
    evaluationMode: options.editorOnly ? "editor-only" : "pipeline",
    startedAt: experiment.startedAt.toISOString(),
    finishedAt: experiment.completedAt.toISOString(),
    fixtureTodayUtc: suite.todayUtc,
    fixtureSha256: createHash("sha256")
      .update(JSON.stringify(suite))
      .digest("hex"),
    fixtureProvenance: suite.provenance,
    modelVersion: config.model,
    reasoningEffort: config.reasoningEffort ?? null,
    promptVersion: RESEARCH_PROMPT_VERSION,
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
