import type { CheckFinding } from "./contracts";
import type { CatalogResearchInput } from "../contracts";
import { assignedGroups, isEventFieldCheck, type GroupOwner } from "../groups";
import type { ResearchContext } from "../research/context";
import type { Targets } from "./general/contracts";

const currentCollectionChecks = {
  identity: "Establish the official Event identity.",
  currentAnnouncement:
    "Collect announcements from inspected pages for General. Record an explicit statement that no next Edition is announced.",
  currentDates:
    "Collect the full festival dates and their year, not a news publication date.",
  currentLocation:
    "Collect available country and place details for the ongoing or announced next festival from known and linked pages. Read useful travel or contact links. Distinguish the festival site from an office, hotel or parking area.",
  currentTickets:
    "Inspect known and linked pages for current tickets. Collect admission prices, mandatory fees, pass duration and conditions from those pages. Exclude payment plans; do not inspect pages only for payment-plan terms.",
  currentClassification:
    "Collect available programme, physical setting and continuity statements from relevant known pages and useful leads. Classification decides whether these support new or retained terms; missing fresh genre names alone does not require another source.",
  currentLinks:
    "Record the official ticket overview and relevant public Edition URLs found on inspected pages.",
};

const fullCollectionChecks = {
  ...currentCollectionChecks,
  previousCompletedEdition:
    "Collect dated history or recap passages and their completion statements. General decides which programme is the latest completed festival; do not require its result before completing collection. Do not audit every archive year.",
  description:
    "Collect material about the current festival format, including any announced changes.",
  eventLinks:
    "Collect official website and social account links from the Event site.",
};

export function buildAssignment(
  input: CatalogResearchInput,
  context: ResearchContext,
) {
  const current = input.mode === "refresh" && input.scope === "current";
  const savedEvent = context.catalog.find(
    (event) => event.id === input.eventId,
  );
  return {
    instructions: current
      ? "Inspect the saved official sources first. Follow the Research search rules for gaps. Collect dates and status for the ongoing or nearest announced future festival. Read available ticket and programme details from known and linked pages. Do not audit Event fields or history."
      : "Inspect relevant known official sources. Collect identity, the latest actually completed festival, and dates for the ongoing or nearest announced future festival. Collect description, public links and programme details from known and linked pages. Collect tickets only for the ongoing or next festival from those pages. Do not infer an unannounced festival.",
    ...(input.mode === "add" ? { researchNote: input.input } : {}),
    checks: Object.entries(
      current ? currentCollectionChecks : fullCollectionChecks,
    ).map(([key, instruction]) => ({ key, instruction })),
    sourcePolicy: {
      discoveryAllowed: true,
      historicalTickets: false,
    },
    identityTask:
      input.mode === "refresh"
        ? "Confirm the supplied Event and select targets, or return uncertain if identity cannot be established. A match with this Event is expected and is not a duplicate add."
        : "Establish the Event identity from inspected sources and select targets, or return uncertain if identity cannot be established. Duplicate checks run before source collection. Return eventId null for add.",
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
    },
    knownLinks: context.knownLinks,
    currentDate: context.currentDate,
    permissions: {
      eventFields: !current,
      previousEdition: !current,
      currentOrNextEdition: true,
    },
  };
}

/** Interpretation checks belong to the role that can assess their meaning. */
export function assignedRoleChecks(
  role: Exclude<GroupOwner, "location">,
  input: CatalogResearchInput,
  targets?: Targets,
): string[] {
  const scope = input.mode === "refresh" ? input.scope : undefined;
  if (role === "general") {
    return [
      "identity",
      "currentAnnouncement",
      "currentDates",
      ...(scope !== "current" ? ["previousCompletedEdition"] : []),
    ];
  }
  const groups = assignedGroups(scope, targets)
    .filter((group) => group.owner !== "location")
    .filter(({ owner }) => owner === role);
  if (role === "classification") {
    // Classification lists Edition checks before the Event check.
    groups.sort(
      (a, b) => Number(a.target === "event") - Number(b.target === "event"),
    );
  }
  return [...new Set(groups.map(({ check }) => check))];
}

export function hasEventFieldCheck(checks: CheckFinding[]) {
  return checks.some(({ check }) => isEventFieldCheck(check));
}
