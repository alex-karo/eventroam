import { readResearchCatalog } from "@/catalog/read/research";
import { evaluateMainCase, assertMainCase, type MainScore } from "./main";
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
import { randomUUID } from "node:crypto";
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
  evalSuiteSchema,
  type EvalCase,
  type PipelineEvalCase,
  type EvalSuite,
} from "./fixtures";
import { sourceLinks } from "./source-links";
import { scoreCase, type CaseScore } from "./score";
import { createEvalScorers } from "./scorers";

import type { EvalToolCall } from "./tool-use";
import { execFileSync } from "node:child_process";
import { EDITOR_PROMPT_VERSION } from "../editor/contracts";
import { createEvalStore, evalDatabasePath } from "./storage";
import { evalDataset, prepareEvalDataset } from "./datasets";
import {
  caseGroup,
  evalGroups,
  selectEvalCases,
  type EvalSelection,
} from "./selection";

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

export type EvalOptions = EvalSelection & {
  model?: string;
  repeat?: number;
  suite?: EvalSuite;
};

export type EvalCaseOutput = {
  report?: CatalogResearchResult;
  location?: LocationExecution;
  runId?: string;
  traceId?: string;
  toolCalls: EvalToolCall[];
  before?: ReturnType<typeof readResearchCatalog>;
  after?: ReturnType<typeof readResearchCatalog>;
} & (
  { quality: MainScore; score?: never } | { score: CaseScore; quality?: never }
);

export function evaluationConfig(options: Pick<EvalOptions, "model">) {
  const env = { ...process.env };
  if (options.model) {
    env.OPENROUTER_MODEL = options.model;
    env.CATALOG_LOCATION_MODEL = options.model;
  }
  return loadResearchConfig(env);
}

async function executeCase(
  suite: EvalSuite,
  item: EvalCase,
  config: ReturnType<typeof evaluationConfig>,
): Promise<EvalCaseOutput> {
  const calls: EvalToolCall[] = [];
  if (item.location) {
    const runId = `location-eval-${randomUUID()}`;
    const tracing = await createRunObservability(
      item.input,
      config.locationModel ?? config.model,
      runId,
      [evalDatabasePath()],
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
        ...(tracing?.root?.traceId ? { traceId: tracing.root.traceId } : {}),
        toolCalls: location.observations
          .filter((observation) => observation.origin === "agent")
          .map((observation) => ({ tool: "geocode" as const, observation })),
        score: scoreLocationCase(item, location),
      };
    } finally {
      await finishRunObservability(tracing);
    }
  }
  const connection = seedDatabase(suite, item);
  try {
    const before =
      item.suite === "main"
        ? readResearchCatalog(connection.client)
        : undefined;
    let result: CatalogResearchResult;
    try {
      result = await runCatalogResearch(
        { ...item.input, dryRun: item.suite !== "main" },
        {
          client: connection.client,
          config,
          todayUtc: item.todayUtc ?? suite.todayUtc,
          geocodingClient: fixedGeocoding(item),
          ...fixedSources(item, item.todayUtc ?? suite.todayUtc, calls),
          ...(item.researchHandoff
            ? {
                generateCandidate: async () =>
                  structuredClone(item.researchHandoff!.candidate),
              }
            : {}),
        },
      );
    } catch (error) {
      const available =
        error instanceof RunPersistenceError
          ? persistenceFailureReport(error)
          : undefined;
      if (!available) {
        throw error;
      }
      result = available;
    }
    if (item.suite === "main") {
      const after = readResearchCatalog(connection.client);
      return {
        quality: evaluateMainCase(item, before!, after, result, calls),
        before,
        after,
        report: result,
        toolCalls: calls,
      };
    }
    return {
      report: result,
      toolCalls: calls,
      score: scoreCase(item, result, calls),
    };
  } finally {
    connection.client.close();
  }
}

function workflowRevision() {
  return execFileSync("/usr/bin/git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
}

export async function runCatalogEvals(options: EvalOptions = {}) {
  const suite = evalSuiteSchema.parse(options.suite ?? loadEvalSuite());
  const selected = selectEvalCases(suite, options);
  for (const item of selected) {
    if (item.suite === "main") {
      assertMainCase(item);
    }
  }
  const repeat = options.repeat ?? 1;
  if (!Number.isSafeInteger(repeat) || repeat < 1 || repeat > 20) {
    throw new Error("repeat must be 1–20");
  }
  const store = await createEvalStore();
  try {
    await store.init();
    const mastra = new Mastra({ storage: store, logger: false });
    // Verify every selected dataset before provider configuration or model calls.
    const prepared = [];
    for (const group of evalGroups) {
      const cases = selected.filter((item) => caseGroup(item) === group);
      if (cases.length) {
        prepared.push(
          await prepareEvalDataset(
            mastra,
            evalDataset(suite, cases, group, repeat),
          ),
        );
      }
    }
    const config = evaluationConfig(options);
    const metadata = {
      workflowRevision: workflowRevision(),
      models: {
        research: config.model,
        editor: config.model,
        location: config.locationModel ?? config.model,
      },
      promptVersions: {
        research: RESEARCH_PROMPT_VERSION,
        editor: EDITOR_PROMPT_VERSION,
        location: LOCATION_PROMPT_VERSION,
      },
      reasoningEffort: config.reasoningEffort ?? null,
      serviceTier: config.serviceTier ?? "standard",
      limits: config.limits,
    };
    const byId = new Map(selected.map((item) => [item.id, item]));
    const groups = [];
    for (const ready of prepared) {
      const group = ready.definition.group;
      const experiment = await ready.dataset.startExperiment({
        version: ready.version,
        name: `${group} — ${config.model}`,
        metadata: { ...metadata, ...ready.definition.metadata },
        scorers: Object.values(createEvalScorers(group === "main/pipeline")),
        maxConcurrency: 3,
        task: async ({ input }): Promise<EvalCaseOutput> => {
          const { caseId } = input as { caseId: string };
          try {
            return await executeCase(suite, byId.get(caseId)!, config);
          } catch {
            throw new Error("Evaluation task failed");
          }
        },
      });
      const results = experiment.results
        .map((attempt) => {
          const input = attempt.input as { caseId: string; repetition: number };
          return {
            ...attempt,
            caseId: input.caseId,
            repetition: input.repetition,
            output: attempt.output as EvalCaseOutput | null,
            locationGroup: byId.get(input.caseId)!.location?.group ?? null,
          };
        })
        .sort(
          (a, b) =>
            a.caseId.localeCompare(b.caseId) || a.repetition - b.repetition,
        );
      groups.push({
        group,
        caseCount: ready.definition.items.length / repeat,
        revision: ready.definition.revision,
        datasetId: ready.definition.id,
        datasetVersion: ready.version,
        metadata,
        ...experiment,
        results,
      });
    }
    return { groups };
  } finally {
    await store.close();
  }
}

export function evalItemPassed(item: {
  error?: unknown;
  output?: unknown;
  scores: {
    scorerId: string;
    score: number | null;
    error?: unknown;
    notScorable?: unknown;
  }[];
}) {
  const output = item.output as EvalCaseOutput | null;
  const main = !!output?.quality;
  const required = Object.values(createEvalScorers(main)).map(
    (scorer) => scorer.id,
  );
  return (
    !item.error &&
    !!(output?.quality?.passed ?? output?.score?.passed) &&
    required.every((id) =>
      item.scores.some(
        (score) =>
          score.scorerId === id &&
          !score.error &&
          (score.score !== null ||
            (score.notScorable &&
              ((id === "required-completeness" &&
                output.quality!.required.expected === 0) ||
                (id === "additional-completeness" &&
                  output.quality!.additional.expected === 0)))),
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
