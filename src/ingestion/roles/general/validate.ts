import type { Evidence } from "../../evidence/contracts";
import { assignedGroups, atPath, record, setPath } from "../../groups";
import { editionSlotNames } from "../../research/contracts";
import { editionEligibility } from "../../research/guards";
import {
  checkGroups,
  validateProposalBoundary,
  type GroupValidationInput,
  failProposal,
  RepairFailure,
  selectedEvent,
  type ProposalValidationContext,
  type Reply,
} from "../proposal-validation";
import {
  festivalCountriesSchema,
  type GeneralOutput,
  type Targets,
} from "./contracts";
import { checkRefreshCountries, validateGeneral } from "./validate-targets";

export function validateGeneralGroups(options: GroupValidationInput) {
  validateProposalBoundary("general", options);
  return checkGroups("general", options);
}

export function validateGeneralReply(
  reply: Reply,
  ctx: ProposalValidationContext,
) {
  const { raw } = reply;
  const { input, context, corpus } = ctx;
  if (
    festivalCountriesSchema.safeParse(record(raw)?.festivalCountries).success
  ) {
    const countryRejection = checkRefreshCountries(
      raw as GeneralOutput,
      input.mode,
      selectedEvent(ctx),
      corpus,
    );
    if (countryRejection) {
      return { targets: countryRejection, groups: [], issues: [] };
    }
  }
  const groups = assignedGroups(input.scope, raw as Targets).filter(
    ({ owner }) => owner === "general",
  );
  const { parsed, issues } = validateGeneralGroups({
    reply,
    groups,
    ctx,
    available: corpus.evidence,
  });
  let candidate = parsed;
  if (issues.length) {
    const provisional = structuredClone(raw);
    for (const { group, rule } of issues) {
      if (/\.(dates|year|scheduleStatus)$/.test(group.path)) {
        failProposal(`General temporal target: ${rule}`, group.path);
      }
      setPath(provisional, group.rawPath, undefined);
    }
    candidate = reply.schema.safeParse(provisional);
  }
  if (!candidate.success) {
    failProposal("Invalid General target");
  }
  const output = candidate.data as GeneralOutput;
  const targets = validateGeneral(output, context, input, corpus);
  if (targets.status === "continue" && issues.length) {
    const event = selectedEvent({ ...ctx, targets: targets.value });
    if (
      editionEligibility(targets.value, event?.editions, input.scope) !==
      "continue"
    ) {
      return { targets, groups, issues: [] };
    }
  }
  return { targets, groups, issues, output };
}

export function requireFixedGeneralTargets(
  raw: unknown,
  ctx: ProposalValidationContext,
  evidence: Evidence[],
) {
  const targets = ctx.targets!;
  if (
    atPath(raw, "decision") !== "targets" ||
    atPath(raw, "eventId") !== targets.eventId ||
    atPath(raw, "observedEventName") !== targets.observedEventName ||
    editionSlotNames.some(
      (slot) => atPath(raw, `${slot}.editionKey`) !== targets[slot]?.editionKey,
    )
  ) {
    failProposal("General changed the fixed identity or target");
  }
  const result = validateGeneral(raw as Targets, ctx.context, ctx.input, {
    ...ctx.corpus,
    evidence,
  });
  if (result.status !== "continue") {
    throw new RepairFailure(
      result.diagnostics.errors[0] ?? {
        code: "invalid_plan",
        stage: "validation",
        message: "General could not confirm the fixed targets",
      },
    );
  }
}
