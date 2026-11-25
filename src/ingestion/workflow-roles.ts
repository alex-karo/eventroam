import { z } from "zod";
import type { CatalogAttempt } from "./attempt";
import type { IngestionData } from "./contracts";
import { repairDiagnostic } from "./repairs";
import { editionEligibility } from "./research/guards";
import { runClassification } from "./roles/classification/agent";
import { runGeneral } from "./roles/general/agent";
import type { Targets } from "./roles/general/contracts";
import { runLinks } from "./roles/links/agent";
import { resolveLocation } from "./roles/location/agent";
import { emptyLocationExecution } from "./roles/location/execution";
import { buildLocationInput } from "./roles/location/input";
import type { RoleOptions } from "./roles/options";
import { runTickets } from "./roles/tickets/agent";
import { assignedSpecialists, type SpecialistRole } from "./specialist-results";
import { stageDiagnostics } from "./stage";

export function workflowRoleOptions(
  owned: CatalogAttempt,
  data: IngestionData,
  signal: AbortSignal,
): RoleOptions {
  return {
    input: owned.input,
    context: data.context!,
    corpus: data.corpus!,
    budget: owned.budget,
    config: owned.config,
    deps: owned.deps,
    signal,
    tracing: owned.trace?.tracing,
    capture: owned.repairs.capture,
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
  data.general = await owned.track(
    runGeneral(workflowRoleOptions(owned, data, signal)),
  );
  try {
    const result = await owned.track(
      owned.repairs.general(
        {
          corpus: data.corpus!,
          context: data.context!,
          input: owned.input,
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
  const saved = data.context!.catalog.find(
    (event) => event.id === diagnostics.matchedEventId,
  );
  if (
    owned.input.mode === "add" &&
    data.researchValidation.status !== "reject" &&
    data.general.output &&
    data.general.output.decision !== "uncertain"
  ) {
    owned.trace?.setEventName(
      saved?.canonicalName ?? data.general.output.observedEventName,
    );
  }
  data.errors.push(...diagnostics.errors);
  data.unresolved.push(...diagnostics.unresolved);
  if (data.researchValidation.status !== "continue") {
    data.outcome =
      data.researchValidation.status === "skip" ? "skipped" : "failed";
  } else {
    const eligibility = editionEligibility(
      data.researchValidation.value,
      saved?.editions,
      owned.input.scope,
    );
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

function assignedTargets(
  owned: CatalogAttempt,
  data: IngestionData,
  role: SpecialistRole,
) {
  if (
    data.researchValidation?.status !== "continue" ||
    data.report ||
    data.outcome !== null
  ) {
    return null;
  }
  const targets = data.researchValidation.value;
  return assignedSpecialists(owned.input.scope, targets).includes(role)
    ? targets
    : null;
}

export const specialistBranchOutputSchema = z.json();
type OrdinarySpecialist = Exclude<SpecialistRole, "location">;
const specialistRunners: Record<
  OrdinarySpecialist,
  (options: RoleOptions, targets: Targets) => Promise<unknown>
> = {
  tickets: (options, targets) => runTickets(options, targets),
  classification: (options, targets) => runClassification(options, targets),
  links: (options, targets) => runLinks(options, targets),
};

export async function runSpecialistBranch(
  role: OrdinarySpecialist,
  owned: CatalogAttempt,
  data: IngestionData,
  signal: AbortSignal,
) {
  const targets = assignedTargets(owned, data, role);
  const metadata = {
    model: owned.config.model,
    promptVersion: role,
    durationMs: 0,
  };
  if (!targets) {
    return {
      status: "not_run",
      skipReason: "No assigned target",
      modelResponse: null,
      errors: [],
      ...metadata,
    };
  }
  const options = workflowRoleOptions(owned, data, signal);
  try {
    const execution = await owned.track(
      specialistRunners[role](options, targets),
    );
    return specialistBranchOutputSchema.parse(execution);
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
  data: IngestionData,
  signal: AbortSignal,
) {
  const targets = assignedTargets(owned, data, "location");
  if (!targets) {
    return specialistBranchOutputSchema.parse(emptyLocationExecution());
  }
  try {
    const execution = await owned.track(
      resolveLocation(
        buildLocationInput(targets, data.corpus!, data.context!, owned.input),
        owned.budget,
        owned.config,
        owned.deps,
        owned.trace?.tracing,
        signal,
        owned.repairs.captureLocation,
      ),
    );
    return specialistBranchOutputSchema.parse(execution);
  } catch {
    return specialistBranchOutputSchema.parse({
      ...emptyLocationExecution(),
      status: "failed",
      errors: [
        {
          code: "location_failed",
          stage: "location",
          message: "Location branch failed",
        },
      ],
    });
  }
}
