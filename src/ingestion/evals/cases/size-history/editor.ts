import { check } from "../../checks";
import type { RegressionCaseDefinition } from "../../regression";
import { researchDidNotFail } from "../../research";
import { emptyLinksReply, emptyTicketsReply } from "../empty-replies";
import { refreshInput, sourceReplay } from "../fixture";

const eventId = "size-event";
const eventName = "River Festival";
const pageUrl = "https://size-fixture.example/festival";

export const editorDescriptionContextCase: RegressionCaseDefinition = {
  fixture: {
    id: "editor-description-context",
    suite: "regression",
    origin: "synthetic",
    task: "Keep supported regular features and reject an invented promise",
    todayUtc: "2026-10-31",
    input: refreshInput(eventId, "full"),
    provenance: {
      kind: "synthetic-editor-regression",
      note: "Uses the size-history page. Fixed proposals isolate review of regular activities and an unsupported free camping promise.",
    },
    initial: {
      event: {
        id: eventId,
        slug: "size-evidence",
        canonicalName: eventName,
        links: [{ kind: "official_site", url: pageUrl, official: true }],
        editions: [
          {
            id: "size-historical",
            editionKey: "historical",
            editionYear: 2026,
            startsOn: "2026-10-10",
            endsOn: "2026-10-12",
            dateState: "confirmed",
            scheduleStatus: "scheduled",
            countryCode: "PT",
            venueName: "River Grounds",
          },
          {
            id: "size-unknown",
            editionKey: "unknown",
            editionYear: 2026,
            startsOn: "2026-11-01",
            endsOn: "2026-11-03",
            dateState: "confirmed",
            scheduleStatus: "scheduled",
            countryCode: "PT",
            venueName: "River Grounds",
          },
        ],
      },
    },
    sources: [sourceReplay(pageUrl, "2026-10-31T12:00:00Z", "page.md")],
    roleHandoff: {
      schemaVersion: 7,
      provenance:
        "Fixed review input from the size-history source. The short text adds a promise that the source does not make.",
      pages: [
        {
          url: pageUrl,
          sourceId: "s1",
          reader: {
            overview:
              "The festival page gives the setting, Edition dates and regular programme.",
            coverage: { found: [], notPublished: [] },
            topics: [
              "identity",
              "description",
              "location",
              "dates",
              "status",
              "classification",
            ],
            statedYears: ["2026"],
            limitations: [],
            evidence: [
              { quote: 2, topics: ["identity", "description", "location"] },
              { quote: 3, topics: ["dates", "status"] },
              { quote: 4, topics: ["dates", "status"] },
              { quote: 5, topics: ["classification"] },
            ],
          },
        },
      ],
      collection: { checks: [], unresolved: [] },
      roles: {
        general: {
          decision: "targets",
          eventId,
          observedEventName: eventName,
          reason:
            "The official page identifies the festival and its site in Portugal.",
          evidenceIds: ["s1-e1"],
          previousEdition: {
            editionKey: "historical",
            reason: "The October programme took place on the saved dates.",
            evidenceIds: ["s1-e2"],
            fields: {},
          },
          currentOrNextEdition: {
            editionKey: "unknown",
            reason: "The official page confirms the November programme.",
            evidenceIds: ["s1-e3"],
            fields: {},
          },
          checks: [],
          unresolved: [],
        },
        tickets: emptyTicketsReply(),
        classification: {
          description: {
            action: "set",
            value:
              "This is an open-air music festival. It combines camping with participant-led workshops. There is dancing at night.",
            reason:
              "The official page identifies the format and the regular programme.",
            evidenceIds: ["s1-e1", "s1-e4"],
          },
          shortDescription: {
            action: "set",
            value:
              "An open-air music festival with free camping for every visitor.",
            reason: "The official page mentions camping in the programme.",
            evidenceIds: ["s1-e1", "s1-e4"],
          },
          previousEdition: {},
          currentOrNextEdition: {},
          checks: [],
          unresolved: [],
        },
        links: emptyLinksReply(),
      },
    },
  },
  evaluate({ report, changes }) {
    return [
      ...researchDidNotFail(report),
      check(
        "catalog.description.regularProgramme",
        changes.event(
          "description",
          (value) =>
            typeof value === "string" &&
            /camping/i.test(value) &&
            /workshops/i.test(value) &&
            /danc/i.test(value),
        ),
        "Save the description of the regular programme",
      ),
      check(
        "catalog.short_description.rejectPromise",
        !changes.event("short_description", (value) => value !== undefined),
        "Do not save the unsupported free camping promise",
      ),
    ];
  },
  moduleUrl: import.meta.url,
};
