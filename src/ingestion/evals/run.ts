import { createWorkflowStorage } from "../runtime/workflow-storage";
import { readResearchCatalog } from "@/catalog/read/research";
import { evaluateMainCase, type MainScore } from "./main";
import type { DescriptionFormat } from "./description-format";
import {
  classificationCases,
  scoreClassification,
  type ClassificationEvalCase,
} from "./classification";
import { runClassification } from "../roles/classification/agent";
import { assignedGroups } from "../groups";
import { refreshScope } from "../roles/assignment";
import { resolveSavedEditions } from "../roles/options";
import { readSource } from "../roles/reader/agent";
import type { RoleExecution } from "../roles/invoke";
import type { ClassificationOutput } from "../roles/classification/contracts";
import { loadResearchContext } from "../research/context";
import {
  resolveLocation,
  type LocationExecution,
} from "../roles/location/agent";
import { LOCATION_PROMPT_VERSION } from "../roles/location/contracts";
import { createResearchBudget } from "../runtime/budget";
import {
  createRunObservability,
  finishRunObservability,
} from "../runtime/observability/runtime";
import { fixedGeocoding } from "./geocoding";
import { scoreLocationCase } from "./score";
import { randomUUID } from "node:crypto";
import { Mastra } from "@mastra/core/mastra";
import type { ItemWithScores } from "@mastra/core/datasets";
import { RunPersistenceError, persistenceFailureReport } from "../runs";
import { runCatalogResearch, type CatalogResearchResult } from "../workflow";
import { evaluationConfig } from "./config";
import { prepareCodexProxy } from "./codex-proxy";
import { PROMPT_VERSIONS } from "../roles/versions";
import type { ReadPageResult } from "../tools/read-page/contracts";
import type { SearchWebResult } from "../tools/search-web/contracts";
import type { ReadPageOptions } from "../tools/read-page/read";
import type { SearchWebOptions } from "../tools/search-web/search";
import {
  loadEvalSuite,
  type PipelineEvalCase,
  type EvalSuite,
} from "./fixtures";
import { scoreCase } from "./score";
import { editorFixtureRoles } from "./editor-fixture";
import { fixedReader } from "./fixed-reader";
import { check, scenarioResult, type ScenarioResult } from "./checks";
import { createEvalScorers } from "./scorers";

import type { EvalToolCall } from "./tool-use";
import { execFileSync } from "node:child_process";
import {
  createEvalStore,
  createEvalObservability,
  evalDatabasePath,
} from "./storage";
import type { DuckDBStore } from "@mastra/duckdb";
import { evalDataset, evalFileHash, prepareEvalDataset } from "./datasets";
import {
  caseGroup,
  evalGroups,
  selectEvalCases,
  type EvalSelection,
  type SelectedEvalCase,
} from "./selection";
import { readerCases, type ReaderEvalOutput } from "./reader";
import { executeReaderCase } from "./reader/run";
import { checkEvidence } from "./reader/checks";
import { seedDatabase } from "./seed-database";

function fixedSources(
  item: PipelineEvalCase,
  todayUtc: string,
  calls: EvalToolCall[],
) {
  const byUrl = new Map<string, ReadPageResult>();
  for (const source of item.sources) {
    const page = { ...source };
    delete page.readerOutput;
    byUrl.set(new URL(page.attemptedUrl).toString(), page);
    byUrl.set(new URL(page.finalUrl).toString(), page);
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
            status: "failed",
            reasonCode: "not_in_eval_fixture",
            markdown: "",
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
  label?: string;
  repeat?: number;
};

export type EvalCaseOutput = {
  report?: CatalogResearchResult;
  location?: LocationExecution;
  reader?: ReaderEvalOutput;
  classification?: RoleExecution<ClassificationOutput>;
  runId?: string;
  traceId?: string;
  toolCalls: EvalToolCall[];
  before?: ReturnType<typeof readResearchCatalog>;
  after?: ReturnType<typeof readResearchCatalog>;
} & (
  | { quality: MainScore; descriptionFormat: DescriptionFormat; score?: never }
  | {
      score: ScenarioResult;
      quality?: never;
      descriptionFormat?: DescriptionFormat;
    }
);

async function executeClassificationCase(
  suite: EvalSuite,
  item: ClassificationEvalCase,
  config: ReturnType<typeof evaluationConfig>,
  experimentId?: string,
  observabilityStore?: DuckDBStore,
): Promise<EvalCaseOutput> {
  const runId = `classification-eval-${randomUUID()}`;
  const tracing = await createRunObservability(
    item.input,
    config.model,
    runId,
    [evalDatabasePath()],
    observabilityStore,
    experimentId,
  );
  try {
    const { client } = seedDatabase(suite, item);
    try {
      const todayUtc = item.todayUtc ?? suite.todayUtc;
      const currentDate = `${todayUtc}T00:00:00.000Z`;
      const context = loadResearchContext(client, item.input, currentDate);
      const budget = createResearchBudget(config.limits);
      const signal = AbortSignal.timeout(config.limits.durationMs);
      const fixture = item.classification;
      const readerChecks = [];
      let { targets } = fixture;
      let corpus;
      if ("source" in fixture) {
        const { markdown, ...source } = fixture.source;
        const reader = await readSource({
          input: {
            assignment: {
              requestedName: targets.observedEventName,
              currentDate,
            },
            source: { ...source, id: "s1" },
            page: markdown,
          },
          budget,
          config,
          signal,
          tracing,
        });
        const { evidence = [], limitations = [] } = reader.bound ?? {};
        readerChecks.push(
          check(
            "reader.execution",
            reader.status === "success" &&
              limitations.length === 0 &&
              evidence.length > 0,
          ),
          ...checkEvidence(fixture.requirements, evidence),
        );
        const evidenceIds = evidence.map(({ id }) => id);
        targets = {
          ...targets,
          evidenceIds,
          currentOrNextEdition: {
            ...targets.currentOrNextEdition!,
            evidenceIds,
          },
        };
        corpus = {
          version: "classification-reader-eval-v1",
          sources: [
            {
              ...source,
              id: "s1",
              processing: "complete" as const,
              limitations,
            },
          ],
          evidence,
        };
      } else {
        corpus = fixture.corpus;
      }
      const scope = refreshScope(item.input);
      const savedEvent = context.catalog.at(0);
      const classification = await runClassification(
        {
          budget,
          config,
          deps: { client },
          signal,
          tracing,
        },
        {
          targets,
          corpus,
          savedEvent,
          savedEditions: resolveSavedEditions(savedEvent, targets),
          currentDate,
          terms: context.terms,
          groups: assignedGroups(scope, targets),
          scope,
        },
      );
      const { score, descriptionFormat } = await scoreClassification(
        item,
        classification,
        context.terms,
      );
      return {
        classification,
        score: scenarioResult([...readerChecks, ...score.checks]),
        descriptionFormat,
        runId,
        ...(tracing?.root?.traceId ? { traceId: tracing.root.traceId } : {}),
        toolCalls: [],
      };
    } finally {
      client.close();
    }
  } finally {
    await finishRunObservability(tracing);
  }
}

async function executeCase(
  suite: EvalSuite,
  item: SelectedEvalCase,
  config: ReturnType<typeof evaluationConfig>,
  experimentId?: string,
  observabilityStore?: DuckDBStore,
): Promise<EvalCaseOutput> {
  if ("reader" in item) {
    return executeReaderCase(
      item,
      item.todayUtc ?? suite.todayUtc,
      config,
      experimentId,
      observabilityStore,
    );
  }
  if ("classification" in item) {
    return executeClassificationCase(
      suite,
      item,
      config,
      experimentId,
      observabilityStore,
    );
  }
  const calls: EvalToolCall[] = [];
  if (item.location) {
    const runId = `location-eval-${randomUUID()}`;
    const tracing = await createRunObservability(
      item.input,
      config.locationModel ?? config.model,
      runId,
      [evalDatabasePath()],
      observabilityStore,
      experimentId,
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
  const workflowStorage = createWorkflowStorage({ path: ":memory:" });
  const fixedLocation = item.roleHandoff?.roles.location;
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
          workflowStorage,
          experimentId,
          observabilityStore,
          config,
          todayUtc: item.todayUtc ?? suite.todayUtc,
          geocodingClient: fixedGeocoding(item),
          ...fixedSources(item, item.todayUtc ?? suite.todayUtc, calls),
          readSource: fixedReader(item),
          generateRoles: editorFixtureRoles(item),
          generateLocation: fixedLocation
            ? async () => structuredClone(fixedLocation)
            : undefined,
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
        ...(await evaluateMainCase(item, before!, after, result)),
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
    await workflowStorage.close();
    connection.client.close();
  }
}

function workflowIdentity() {
  const git = (args: string[]) =>
    execFileSync("/usr/bin/git", args, { encoding: "utf8" }).trim();
  return {
    workflowRevision: git(["rev-parse", "HEAD"]),
    workflowBranch: git(["branch", "--show-current"]) || null,
    workflowDirty: git(["status", "--porcelain"]) !== "",
  };
}

export async function runCatalogEvals(options: EvalOptions = {}) {
  const suite = loadEvalSuite();
  const selected = selectEvalCases(
    {
      cases: [
        ...suite.cases,
        ...readerCases(suite),
        ...classificationCases(suite),
      ],
    },
    options,
  );
  const repeat = options.repeat ?? 1;
  if (!Number.isSafeInteger(repeat) || repeat < 1 || repeat > 20) {
    throw new Error("repeat must be 1–20");
  }
  await using proxy = await prepareCodexProxy(options);
  const store = await createEvalStore();
  const observations = await createEvalObservability();
  try {
    await store.init();
    const mastra = new Mastra({ storage: store, logger: false });
    const fileHash = evalFileHash();
    const prepared = [];
    for (const group of evalGroups) {
      const cases = selected.filter((item) => caseGroup(item) === group);
      if (cases.length) {
        prepared.push(
          await prepareEvalDataset(
            mastra,
            evalDataset(suite, cases, group, repeat, fileHash),
          ),
        );
      }
    }
    const config = evaluationConfig(options, proxy.environment);
    const metadata = {
      ...workflowIdentity(),
      label: options.label?.trim() || null,
      models: {
        ...Object.fromEntries(
          Object.keys(PROMPT_VERSIONS).map((role) => [role, config.model]),
        ),
        location: config.locationModel ?? config.model,
      },
      promptVersions: {
        ...PROMPT_VERSIONS,
        location: LOCATION_PROMPT_VERSION,
      },
      reasoningEffort: config.reasoningEffort ?? null,
      serviceTier: config.serviceTier ?? "standard",
      limits: config.limits,
    };
    const byId = new Map(selected.map((item) => [item.id, item]));
    const groups = [];
    const experimentsStore = (await store.getStore("experiments"))!;
    for (const ready of prepared) {
      const group = ready.definition.group;
      const scorers = Object.values(createEvalScorers(group));
      const scorerIds = scorers.map((scorer) => scorer.id);
      const model =
        group === "regression/location"
          ? metadata.models.location
          : config.model;
      const name = [
        metadata.workflowBranch ?? metadata.workflowRevision.slice(0, 8),
        group,
        model,
        metadata.label,
      ]
        .filter(Boolean)
        .join(" · ");
      let experimentId: string | undefined;
      const experiment = await ready.dataset.startExperiment({
        version: ready.version,
        name,
        metadata: { ...metadata, ...ready.definition.metadata },
        scorers,
        maxConcurrency: 3,
        beforeAll: (args) => {
          experimentId = args.experimentId;
        },
        // Inline tasks do not expose their trace identity to Mastra's runner.
        // Add our real trace to its saved row through the native storage API.
        afterEach: async ({ experimentId, result }) => {
          const output = result.output as EvalCaseOutput | null;
          const traceId = output?.report?.traceId ?? output?.traceId;
          if (traceId) {
            await experimentsStore.upsertExperimentResult({
              experimentId,
              itemId: result.itemId,
              itemDatasetVersion: result.itemVersion,
              input: result.input,
              output: result.output,
              groundTruth: result.groundTruth,
              metadata: result.metadata,
              error: result.error,
              startedAt: result.startedAt,
              completedAt: result.completedAt,
              retryCount: result.retryCount,
              traceId,
            });
          }
        },
        task: async ({ input }): Promise<EvalCaseOutput> => {
          const { caseId } = input as { caseId: string };
          try {
            return await executeCase(
              suite,
              byId.get(caseId)!,
              config,
              experimentId,
              observations?.storage,
            );
          } catch {
            throw new Error("Evaluation task failed");
          }
        },
      });
      const results = experiment.results
        .map((attempt) => {
          const input = attempt.input as { caseId: string; repetition: number };
          const item = byId.get(input.caseId)!;
          const output = attempt.output as EvalCaseOutput | null;
          return {
            ...attempt,
            caseId: input.caseId,
            repetition: input.repetition,
            output,
            passed: evalItemPassed(attempt, output, scorerIds),
            locationGroup:
              "location" in item ? (item.location?.group ?? null) : null,
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
        name,
        results,
      });
    }
    return { groups };
  } finally {
    await observations?.close();
    await store.close();
  }
}

function evalItemPassed(
  item: ItemWithScores,
  output: EvalCaseOutput | null,
  scorerIds: string[],
) {
  return (
    !item.error &&
    !!(output?.quality?.passed ?? output?.score?.passed) &&
    scorerIds.every((id) =>
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
