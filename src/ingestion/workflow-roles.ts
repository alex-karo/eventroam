import { z } from "zod";
import type { CatalogAttempt } from "./attempt";
import type { IngestionData } from "./contracts";
import { assignedGroups } from "./groups";
import { repairDiagnostic } from "./repairs";
import { editionEligibility } from "./research/guards";
import { runClassification } from "./roles/classification/agent";
import { runGeneral } from "./roles/general/agent";
import type { RoleExecution } from "./roles/invoke";
import { runLinks } from "./roles/links/agent";
import { resolveLocation } from "./roles/location/agent";
import { emptyLocationExecution } from "./roles/location/execution";
import { buildLocationInput } from "./roles/location/input";
import {
  resolveSavedEditions,
  type RoleOptions,
  type RoleRuntimeOptions,
  type SpecialistContext,
} from "./roles/options";
import { runTickets } from "./roles/tickets/agent";
import { assignedSpecialists, type SpecialistRole } from "./specialist-results";
import { stageDiagnostics } from "./stage";

function workflowRoleRuntime(
  owned: CatalogAttempt,
  signal: AbortSignal,
): RoleRuntimeOptions {
  return {
    budget: owned.budget,
    config: owned.config,
    deps: owned.deps,
    signal,
    tracing: owned.trace?.tracing,
    capture: owned.repairs.capture,
  };
}

export function workflowRoleOptions(
  owned: CatalogAttempt,
  data: IngestionData,
  signal: AbortSignal,
): RoleOptions {
  return {
    ...workflowRoleRuntime(owned, signal),
    input: owned.input,
    context: data.context!,
    corpus: data.corpus!,
  };
}

export async function selectGeneralTargets(
  owned: CatalogAttempt,
  data: IngestionData,
  signal: AbortSignal,
) {
  if (data.outcome === "failed") {
    return null;
  }
  const options = workflowRoleOptions(owned, data, signal);
  const { input, context, corpus } = options;
  const savedEvent = context.catalog.at(0);
  data.general = await owned.track(runGeneral(options));
  try {
    const result = await owned.track(
      owned.repairs.general(
        {
          corpus,
          currentDate: context.currentDate,
          terms: context.terms,
          input,
          savedEvent,
        },
        signal,
      ),
    );
    if (result?.revisedOutput) {
      data.general = {
        ...data.general,
        ...(data.general.status === "failed" && { responseFailed: true }),
        status: "success",
        output: result.revisedOutput,
        errors: [],
      };
    }
    data.researchValidation = result?.targets ?? null;
  } catch (error) {
    data.errors.push(repairDiagnostic(error));
    data.outcome = "failed";
    return data.general;
  }
  if (!data.researchValidation) {
    data.errors.push(...data.general.errors);
    data.outcome = "failed";
    return data.general;
  }
  const diagnostics = stageDiagnostics(data.researchValidation);
  if (
    owned.input.mode === "add" &&
    data.researchValidation.status !== "reject" &&
    data.general.output &&
    data.general.output.decision !== "uncertain"
  ) {
    owned.trace?.setEventName(data.general.output.observedEventName);
  }
  data.errors.push(...diagnostics.errors);
  data.unresolved.push(...diagnostics.unresolved);
  if (data.researchValidation.status !== "continue") {
    data.outcome =
      data.researchValidation.status === "skip" ? "skipped" : "failed";
  } else {
    const targets = data.researchValidation.value;
    const eligibility = editionEligibility(
      targets,
      savedEvent?.editions,
      input.scope,
    );
    if (eligibility === "continue" && data.outcome === null) {
      const groups = assignedGroups(input.scope, targets);
      owned.specialistContext = {
        scope: input.scope,
        targets,
        savedEvent,
        savedEditions: resolveSavedEditions(savedEvent, targets),
        groups,
        specialists: assignedSpecialists(groups),
        corpus,
        currentDate: context.currentDate,
        terms: context.terms,
      };
    }
    if (eligibility !== "continue") {
      data.outcome = eligibility;
    }
    if (eligibility === "skipped") {
      data.unresolved.push({
        field: "edition",
        message: "Insufficient information about editions",
      });
    }
  }
  return { execution: data.general, targets: data.researchValidation };
}

type OrdinarySpecialist = Exclude<SpecialistRole, "location">;
const specialistBranchJson = z.json();
const specialistRunners = {
  tickets: (options, selection) =>
    runTickets(options, {
      target: selection.targets.currentOrNextEdition,
      saved: selection.savedEditions.currentOrNextEdition,
      groups: selection.groups,
      corpus: selection.corpus,
      currentDate: selection.currentDate,
    }),
  classification: (options, selection) =>
    runClassification(options, {
      targets: selection.targets,
      savedEvent: selection.savedEvent,
      savedEditions: selection.savedEditions,
      groups: selection.groups,
      corpus: selection.corpus,
      currentDate: selection.currentDate,
      scope: selection.scope,
      terms: selection.terms,
    }),
  links: (options, selection) =>
    runLinks(options, {
      targets: selection.targets,
      savedEventLinks: selection.savedEvent?.links,
      savedEditions: selection.savedEditions,
      groups: selection.groups,
      corpus: selection.corpus,
      currentDate: selection.currentDate,
      scope: selection.scope,
    }),
} satisfies Record<
  OrdinarySpecialist,
  (
    options: RoleRuntimeOptions,
    selection: SpecialistContext,
  ) => Promise<unknown>
>;

export async function runSpecialistBranch(
  role: OrdinarySpecialist,
  owned: CatalogAttempt,
  selection: SpecialistContext | null,
  signal: AbortSignal,
) {
  const metadata = {
    model: owned.config.model,
    promptVersion: role,
    durationMs: 0,
  };
  if (!selection?.specialists.includes(role)) {
    return {
      status: "not_run",
      skipReason: "No assigned target",
      modelResponse: null,
      errors: [],
      ...metadata,
    };
  }
  try {
    const execution = await owned.track<RoleExecution>(
      specialistRunners[role](workflowRoleRuntime(owned, signal), selection),
    );
    specialistBranchJson.parse(execution);
    return execution;
  } catch {
    return {
      status: "failed",
      modelResponse: null,
      errors: [
        {
          code: "workflow_failed",
          stage: "workflow",
          message: `${role} branch failed`,
        },
      ],
      ...metadata,
    };
  }
}

export async function runLocationBranch(
  owned: CatalogAttempt,
  selection: SpecialistContext | null,
  signal: AbortSignal,
) {
  if (!selection?.specialists.includes("location")) {
    return emptyLocationExecution();
  }
  try {
    const execution = await owned.track(
      resolveLocation(
        buildLocationInput({
          targets: selection.targets,
          corpus: selection.corpus,
          currentDate: selection.currentDate,
          scope: selection.scope,
          savedEditions: selection.savedEditions,
          savedEvent: selection.savedEvent,
        }),
        owned.budget,
        owned.config,
        owned.deps,
        owned.trace?.tracing,
        signal,
        owned.repairs.captureLocation,
      ),
    );
    specialistBranchJson.parse(execution);
    return execution;
  } catch {
    return {
      ...emptyLocationExecution(),
      status: "failed",
      errors: [
        {
          code: "location_failed",
          stage: "location",
          message: "Location branch failed",
        },
      ],
    };
  }
}
