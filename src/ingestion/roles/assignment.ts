import type { CatalogResearchInput } from "../contracts";
import type { ResearchContext } from "../research/context";

export function buildAssignment(
  input: CatalogResearchInput,
  context: ResearchContext,
) {
  const current = input.mode === "refresh" && input.scope === "current";
  const savedEvent = context.catalog.find(
    (event) => event.id === input.eventId,
  );
  const checks = [
    "identity",
    "currentAnnouncement",
    "currentDates",
    "currentLocation",
    "currentTickets",
    "currentClassification",
    "currentLinks",
    ...(!current
      ? ["previousCompletedEdition", "description", "eventLinks"]
      : []),
  ];
  return {
    instructions: current
      ? "Inspect the saved official sources. Collect the ongoing festival or nearest announced future festival, dates, status, place, tickets, ticket overview and programme. Do not audit Event fields or history. Do not find a replacement website. Stop on a material identity contradiction and request a full refresh. Targeted discovery for unresolved programme dates, another publication-required Edition fact or a concrete festival place is permitted; other missing optional details do not permit discovery."
      : "Inspect relevant known official sources. Collect identity, description, public links, latest actually completed festival and ongoing or nearest announced future festival, dates, place and programme. Collect tickets only for the ongoing or next festival. Use permitted discovery only when needed. Do not infer an unannounced festival.",
    checks: checks.map((key) => ({
      key,
      mandatory: true,
      instruction: {
        identity: "Establish the official Event identity.",
        currentAnnouncement:
          "Find the ongoing or nearest announced festival; record an explicit absence of announcement.",
        currentDates:
          "Collect the full festival dates and their year, not a news publication date.",
        currentLocation:
          "Find the concrete festival place for the ongoing or announced next festival, even when its country is known. Read useful travel, getting-here or contact leads before targeted search within the shared budget. A venue with city or area, source-supported address or map point is sufficient; no street address is required for a field or forest. Stop when the place is concrete, explicitly not announced, or no useful permitted step remains. Missing venue does not prevent publication. Distinguish the festival site from an office, hotel or parking area.",
        currentTickets:
          "Inspect the current official ticket overview, with prices, mandatory fees, pass duration and conditions.",
        currentClassification:
          "Collect available programme, physical setting and continuity statements from relevant known pages and useful leads. Classification decides whether these support new or retained terms; missing fresh genre names alone does not require another source.",
        currentLinks:
          "Find the official ticket overview and relevant public Edition links.",
        previousCompletedEdition:
          "Collect dated history or recap passages and their completion statements. General decides which programme is the latest completed festival; do not require its result before completing collection. Do not audit every archive year.",
        description:
          "Collect the Event description and any participant figure with its qualifications.",
        eventLinks:
          "Collect official website and social account links from the Event site.",
      }[key],
    })),
    sourcePolicy: {
      discoveryAllowed: true,
      recoverWebsite: !current,
      historicalTickets: false,
    },
    identityTask:
      input.mode === "refresh"
        ? "Confirm the supplied Event and select targets, or return uncertain if identity cannot be established. A match with this Event is expected and is not a duplicate add."
        : "Compare the proposed Event with catalog candidates. Return duplicate only for a confirmed existing Event; otherwise select targets or return uncertain.",
    identityContext: {
      requestedName: input.name ?? context.catalog[0]?.canonicalName,
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
      eventFields: !current,
      previousEdition: !current,
      currentOrNextEdition: true,
    },
  };
}

/** Interpretation checks belong to the role that can assess their meaning. */
export function assignedRoleChecks(
  role: "general" | "tickets" | "classification" | "links",
  input: CatalogResearchInput,
  targets?: import("./contracts").Targets,
) {
  const current = input.mode === "refresh" && input.scope === "current";
  const hasNext = !!targets?.currentOrNextEdition;
  if (role === "general") {
    return [
      "identity",
      "currentAnnouncement",
      "currentDates",
      ...(!current ? ["previousCompletedEdition", "description"] : []),
    ];
  }
  if (role === "tickets") {
    return hasNext ? ["currentTickets"] : [];
  }
  if (role === "classification") {
    return [
      ...(targets?.previousEdition ? ["previousClassification"] : []),
      ...(hasNext ? ["currentClassification"] : []),
    ];
  }
  return [
    ...(!current ? ["eventLinks"] : []),
    ...(hasNext ? ["currentLinks"] : []),
  ];
}
