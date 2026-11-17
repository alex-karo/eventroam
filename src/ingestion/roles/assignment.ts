import type { CatalogResearchInput } from "../contracts";
import { assignedGroups, fieldAssignments, type GroupOwner } from "../groups";
import { effectiveScope, requestsSlot } from "../scope";
import type { ResearchContext } from "../research/context";
import type { Targets } from "./general/contracts";

export function buildAssignment(
  input: CatalogResearchInput,
  context: ResearchContext,
) {
  const scope = effectiveScope(input);
  const savedEvent = context.catalog.find(
    (event) => event.id === input.eventId,
  );
  const fields = fieldAssignments(scope);
  const checks = [
    {
      key: "identity",
      mandatory: true,
      instruction:
        "Establish the official Event identity and report observed country contradictions.",
    },
    ...(["previousEdition", "currentOrNextEdition"] as const)
      .filter((slot) => requestsSlot(input, slot))
      .map((slot) => {
        const mandatory = fields.some(
          ({ group, required }) => group.target === slot && required,
        );
        const selectionInstruction =
          slot === "previousEdition"
            ? "Collect dated history and completion statements for the latest actually completed festival. Do not audit every year."
            : "Find the ongoing or nearest announced festival. Distinguish confirmed absence from unfinished selection.";
        return {
          key: `${slot}.select`,
          mandatory,
          instruction: mandatory
            ? selectionInstruction
            : "Use only facts found during required work to select this optional target. Do no extra discovery. Leave the target null when the evidence does not establish it.",
        };
      }),
    ...fields.map(({ group, required, instruction }) => ({
      key: group.path,
      mandatory: required,
      instruction: instruction ?? standardFieldInstruction(group.path),
    })),
  ];
  return {
    scope,
    instructions:
      "Inspect official sources for the assigned fields and requested selectors only. Keep identity, temporal and observed country context. Recover an official source when assigned work needs it. Use optional facts found during assigned work without extra discovery. Instructions add detail but grant no new fields or targets. Do not infer an unannounced festival.",
    ...(input.mode === "add" ? { researchNote: input.input } : {}),
    checks,
    identityTask:
      input.mode === "refresh"
        ? "Confirm the supplied Event and select targets, or return uncertain if identity cannot be established. A match with this Event is expected and is not a duplicate add."
        : "Compare the proposed Event with catalog candidates. Return duplicate only for a confirmed existing Event; otherwise select targets or return uncertain.",
    identityContext: {
      requestedName: savedEvent?.canonicalName,
      eventId: input.eventId ?? null,
      countryCodes: [
        ...new Set(
          savedEvent?.editions.flatMap((edition) =>
            edition.countryCode ? [edition.countryCode] : [],
          ) ?? [],
        ),
      ],
      localities: [
        ...new Set(
          savedEvent?.editions.flatMap((edition) =>
            edition.locality ? [edition.locality] : [],
          ) ?? [],
        ),
      ],
      knownNames: context.catalog.map((event) => ({
        id: event.id,
        name: event.canonicalName,
      })),
    },
    knownLinks: context.knownLinks,
    currentDate: context.currentDate,
    permissions: {
      eventFields: scope.tasks.some(({ target }) => target === "event"),
      previousEdition: requestsSlot(input, "previousEdition"),
      currentOrNextEdition: requestsSlot(input, "currentOrNextEdition"),
    },
  };
}

/** Interpretation checks belong to the role that can assess their meaning. */
export function assignedRoleChecks(
  role: Exclude<GroupOwner, "location">,
  input: CatalogResearchInput,
  targets?: Targets,
): string[] {
  return [
    ...(role === "general"
      ? [
          "identity",
          ...(["previousEdition", "currentOrNextEdition"] as const)
            .filter((slot) => requestsSlot(input, slot))
            .map((slot) => `${slot}.select`),
        ]
      : []),
    ...assignedGroups(effectiveScope(input), targets)
      .filter(({ owner }) => owner === role)
      .map(({ path }) => path),
  ];
}

function standardFieldInstruction(path: string): string {
  const field = path.split(".fields.")[1];
  if (field === "description" || field === "shortDescription") {
    return "Collect material about the current festival format, including announced changes.";
  }
  if (field === "dates" || field === "year" || field === "scheduleStatus") {
    return "Collect the complete programme dates, their year, cancellation and postponement. A news date is not a programme date.";
  }
  if (field === "location") {
    return "Find the concrete festival place. Read useful travel, getting-here or contact leads before targeted search. A venue with a city or area is sufficient; detailed address and coordinates are optional. Distinguish the festival site from an office, hotel or parking area.";
  }
  if (field === "classification") {
    return "Collect programme, physical setting and continuity statements. Missing fresh genre names alone does not require another source.";
  }
  if (field === "tickets") {
    return "Inspect full-programme admission, mandatory fees, pass duration and conditions. Exclude payment plans and pages only about payment-plan terms.";
  }
  if (field === "sizeEstimate") {
    return "Use supported participant estimates. Do not derive attendance from ticket capacity or social account followers.";
  }
  if (field === "links.tickets") {
    return "Find the official ticket overview link without auditing admission prices.";
  }
  if (field.startsWith("links.")) {
    return "Collect the assigned official website or social account link from official sources.";
  }
  return "Use inspected official evidence and the standard field rules. Preserve unsupported saved values.";
}
