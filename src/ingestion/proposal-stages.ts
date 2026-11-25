import type { CatalogAttempt } from "./attempt";
import type { IngestionData } from "./contracts";
import type { ProposalGroup } from "./groups";
import {
  applyReview,
  assembleProposals,
  type PreparedProposals,
  type SpecialistOutputs,
} from "./proposals";
import { repairDiagnostic, type RepairRecord } from "./repairs";
import { runEditor } from "./roles/editor/agent";
import type { ReviewDecisions } from "./roles/editor/contracts";
import { editorMetrics } from "./roles/editor/metrics";
import { reviewReturns, reviewScope } from "./roles/editor/review";
import type { Targets } from "./roles/general/contracts";
import type { RoleOptions, SpecialistContext } from "./roles/options";
import {
  specialistFailures,
  specialistResultsSchema,
} from "./specialist-results";
import {
  diagnosticsOnly,
  initialDiagnostics,
  type PlanDiagnostics,
} from "./stage";
import { logPreparation } from "./workflow-logging";

export async function prepareSpecialistProposals(
  owned: CatalogAttempt,
  data: IngestionData,
  signal: AbortSignal,
  selection: SpecialistContext | null,
  inputData: unknown,
) {
  if (!selection || data.outcome !== null) {
    return null;
  }
  const parsed = specialistResultsSchema.safeParse(inputData);
  if (!parsed.success) {
    data.errors.push({
      code: "workflow_failed",
      stage: "workflow",
      message: "Specialist results are missing or invalid",
    });
    data.outcome = "failed";
    return null;
  }
  const results = parsed.data;
  for (const role of ["tickets", "classification", "links"] as const) {
    data.specialists[role] = results[role];
  }
  if (results.location.status !== "not_run") {
    data.location = results.location;
  }
  const firstQuestions = [
    ...(data.location.materialized?.unresolved ?? []),
    ...Object.values(results).flatMap((execution) =>
      execution.status === "success" && "output" in execution
        ? execution.output.unresolved
        : [],
    ),
  ];
  const failures = specialistFailures(results, selection.specialists, (role) =>
    Boolean(owned.repairs.raw(role)),
  );
  if (failures.length) {
    data.errors.push(...failures);
    data.unresolved.push(...firstQuestions);
    data.outcome = "failed";
    return results;
  }
  try {
    const outputs = await owned.track(
      owned.repairs.beforeReview(
        {
          ...selection,
          input: owned.input,
        },
        signal,
      ),
    );
    return assemblePreparedProposals(owned, data, selection, outputs);
  } catch (error) {
    data.errors.push(repairDiagnostic(error));
    data.unresolved.push(...firstQuestions);
    data.outcome = "failed";
    return results;
  }
}

function assemblePreparedProposals(
  owned: CatalogAttempt,
  data: IngestionData,
  selection: SpecialistContext,
  outputs: SpecialistOutputs,
  revisedTargets?: Targets & PlanDiagnostics,
) {
  for (const role of ["tickets", "classification", "links"] as const) {
    const output = outputs[role];
    const execution = data.specialists[role];
    if (execution && output) {
      data.specialists[role] = {
        ...execution,
        ...(role === "classification" &&
          execution.status === "failed" && { responseFailed: true }),
        status: "success",
        output,
        errors: [],
      };
    }
  }
  const location = owned.repairs.materializeLocation();
  if (location) {
    if (data.location.status === "failed") {
      data.location.responseFailed = true;
    }
    data.location.materialized = location;
    data.location.status = "success";
    data.location.errors = [];
  }
  const oldQuestions =
    data.prepared?.status === "continue"
      ? data.prepared.value.unresolved
      : selection.targets.unresolved;
  data.prepared = assembleProposals({
    selection,
    revisedTargets,
    ...outputs,
    location: data.location.materialized ?? {
      support: {},
      slots: {},
      previousPoints: [],
      unresolved: [],
    },
    points: data.location.points,
    returnedPaths: owned.repairs.returnedPaths,
  });
  if (data.prepared.status !== "continue") {
    data.outcome = "failed";
    data.errors.push(...data.prepared.diagnostics.errors);
  } else {
    data.unresolved = [
      ...data.unresolved.filter(
        (entry) =>
          !oldQuestions.some(
            (question) =>
              question.message === entry.message &&
              question.field === entry.field &&
              question.editionKey === entry.editionKey,
          ),
      ),
      ...data.prepared.value.unresolved,
    ];
  }
  return data.prepared;
}

function applyRepairRejections(
  review: ReviewDecisions,
  records: readonly Readonly<RepairRecord>[],
) {
  const latest = new Map(records.map((entry) => [entry.path, entry]));
  for (const { path, decision } of latest.values()) {
    if (decision?.decision === "reject") {
      review.set(path, decision);
    }
  }
}

export async function reviewPreparedProposals(
  owned: CatalogAttempt,
  data: IngestionData,
  options: RoleOptions,
) {
  const selection = owned.specialistContext;
  if (
    !selection ||
    data.prepared?.status !== "continue" ||
    data.outcome === "failed"
  ) {
    return null;
  }
  const { input, signal } = options;
  const { repairs } = owned;
  let prepared = data.prepared.value;
  const { targets: originalTargets, groups } = selection;
  const repairContext = { ...selection, input };
  const review: ReviewDecisions = new Map();
  applyRepairRejections(review, repairs.records);
  const metrics = owned.captureMetric
    ? editorMetrics(owned.captureMetric, groups, prepared, review, repairs)
    : undefined;

  async function runReview(
    proposals: PreparedProposals,
    targetedGroups?: readonly ProposalGroup[],
  ) {
    metrics?.reviewCalled();
    const selectedGroups =
      targetedGroups ??
      groups.filter(({ path }) => review.get(path)?.decision !== "reject");
    const paths = new Set(selectedGroups.map(({ path }) => path));
    const execution = await owned.track(
      runEditor(
        options,
        proposals,
        reviewScope(
          proposals,
          selectedGroups,
          repairs.returnCounts,
          (owner) => repairs.canReturn(owner),
          !!targetedGroups,
        ),
        targetedGroups
          ? repairs.records.filter(({ path }) => paths.has(path))
          : repairs.records,
        targetedGroups,
      ),
    );
    if (execution.status === "success" && execution.output) {
      for (const entry of execution.output.decisions) {
        review.set(entry.path, entry);
      }
    }
    return execution;
  }

  try {
    const execution = await runReview(prepared);
    metrics?.firstReview(execution.output?.decisions);
    data.editor = {
      status: execution.status,
      modelResponse: execution.modelResponse,
      errors: execution.errors,
    };
    if (execution.status !== "success" || !execution.output) {
      data.errors.push(...execution.errors);
      logPreparation(
        owned.trace?.log,
        {
          status: "reject",
          diagnostics: { ...initialDiagnostics(), errors: execution.errors },
        },
        originalTargets,
      );
      data.outcome = "failed";
      return execution;
    }

    for (
      let returned = reviewReturns(review, groups);
      returned.length;
      returned = reviewReturns(review, groups)
    ) {
      try {
        const round = await owned.track(
          repairs.afterReview(
            repairContext,
            returned,
            signal,
            metrics?.trackReturns(prepared),
          ),
        );
        applyRepairRejections(review, round.records);
        const revised = assemblePreparedProposals(
          owned,
          data,
          selection,
          round.outputs,
          {
            ...diagnosticsOnly(originalTargets),
            ...(round.generalTargets ?? prepared.targets),
          },
        );
        if (revised.status !== "continue") {
          return revised;
        }
        prepared = revised.value;
        const returnedPaths = new Set(returned.map(({ group }) => group.path));
        const returnedGroups = groups.filter(
          ({ path }) =>
            returnedPaths.has(path) && review.get(path)?.decision !== "reject",
        );
        if (!returnedGroups.length) {
          continue;
        }

        const targeted = await runReview(prepared, returnedGroups);
        if (targeted.status !== "success" || !targeted.output) {
          data.errors.push(...targeted.errors);
          data.editor = {
            status: "failed",
            modelResponse: targeted.modelResponse ?? data.editor.modelResponse,
            ...(targeted.modelResponse === null && {
              responseStatus: "success",
            }),
            errors: [...data.editor.errors, ...targeted.errors],
          };
          data.outcome = "failed";
          round.recordEditorFailure(targeted.errors[0]);
          return targeted;
        }
      } catch (error) {
        data.errors.push(repairDiagnostic(error));
        data.outcome = "failed";
        return null;
      }
    }

    for (const entry of repairs.records) {
      entry.decision = review.get(entry.path);
    }
    signal.throwIfAborted();
    data.editorValidation = applyReview(prepared, review);
    logPreparation(owned.trace?.log, data.editorValidation, originalTargets);
    if (data.editorValidation.status !== "continue") {
      data.outcome = "failed";
      data.errors.push(...data.editorValidation.diagnostics.errors);
    }
    return data.editorValidation;
  } finally {
    metrics?.finish(data.editorValidation?.status, signal.aborted);
  }
}
