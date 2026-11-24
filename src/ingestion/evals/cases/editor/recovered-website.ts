import { officialWebsite } from "../../changes";
import type { RegressionCaseDefinition } from "../../regression";
import { researchDidNotFail, editionSlots } from "../../research";
import { fixedHandoff, readerSelection, passage, setField } from "./fixture";
import { emptyTicketsReply } from "../empty-replies";
import { refreshInput, sourceReplay } from "../fixture";

const eventId = "search-policy-event";
const eventName = "Harbor Echo";
const homePage = "https://harborechoaustralia.com/";

export const editorRecoveredWebsiteCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: {
    id: "editor-recovered-website",
    suite: "regression",
    origin: "synthetic",
    task: "Check editor recovered website",
    todayUtc: "2026-10-15",
    provenance: {
      kind: "captured-research-editor-regression",
      note: "Captured domain proposals test approval of the GB replacement despite the saved Australian namesake URL. Fixed source-backed Reader passages include both identities and the UK programme. Research and Reader do not call a model; Editor and eligible Location still run.",
    },
    input: refreshInput(eventId, "full"),
    initial: {
      event: {
        id: eventId,
        slug: eventId,
        canonicalName: eventName,
        links: [{ kind: "official_site", url: homePage, official: true }],
        editions: [
          {
            id: "search-policy-edition",
            editionKey: "2027",
            editionYear: 2027,
            startsOn: "2027-01-23",
            endsOn: "2027-01-30",
            dateState: "confirmed",
            scheduleStatus: "scheduled",
            countryCode: "GB",
            locality: "Castlewellan",
            venueName: "Castlewellan Grounds",
            termIds: [],
          },
        ],
      },
    },
    sources: [
      sourceReplay(
        "https://harborechofestival.co.uk/",
        "2026-10-15T12:00:00Z",
        "../search-policy/official.md",
      ),
      sourceReplay(
        homePage,
        "2026-10-15T12:00:00Z",
        "../search-policy/wrong.md",
      ),
      sourceReplay(
        "https://harborechofestival.co.uk/programme",
        "2026-10-15T12:00:00Z",
        "../search-policy/official.md",
      ),
    ],
    roleHandoff: fixedHandoff(
      "Exact search-wrong-official research from narrow-current-main-merge.json; openai/gpt-6-luna, narrow-current-focused-search-v1; provider wire-null omission normalized, findings unchanged. Adapted to fixed domain roles. Fixed Reader selections use source-backed artifacts from the standard-tier 2026-11-02 run. Some excerpts extend to source segment boundaries. Captures: 5550e1f9-71d5-4c92-9a11-b608a2cd0606:s1, d49da0ea-52fe-4649-ada1-711ae62fe65a:s3. Collection reads only the fixed pages. Captured proposals have explicit citations and retain their unchecked findings; they make no new claim of complete research. No model is called for Research, Reader or the captured specialists. Editor and eligible Location still run. Page-coverage lists are empty because these fixed inputs test Editor, not Research navigation.",
      [
        {
          url: homePage,
          sourceId: "s1",
          reader: readerSelection({
            overview:
              "The page identifies Harbor Echo Australia and says its 2027 festival is in Byron Bay on 1–3 February; it distinguishes a separate festival in Castlewellan, Northern Ireland.",
            topics: ["identity", "dates", "location"],
            statedYears: ["2027"],
            limitations: [
              "The page provides no description, status, participant count, ticket information, classification, or official links to either festival.",
            ],
            evidence: [
              passage([1, 2], "identity", "dates", "location"),
              passage(2, "identity", "location"),
            ],
          }),
        },
        {
          url: "https://harborechofestival.co.uk/",
          sourceId: "s2",
          reader: readerSelection({
            overview:
              "Harbor Echo identifies itself as a Castlewellan festival in Northern Ireland. Its first edition is announced for 23–30 January 2027, with an outdoor music programme and free admission; no earlier edition has taken place.",
            topics: [
              "identity",
              "description",
              "dates",
              "status",
              "tickets",
              "classification",
              "location",
              "links",
            ],
            statedYears: ["2027"],
            limitations: [],
            evidence: [
              passage(2, "identity", "location", "links"),
              passage(
                3,
                "description",
                "dates",
                "status",
                "tickets",
                "classification",
                "location",
                "size",
              ),
              passage(4, "dates", "status"),
            ],
          }),
        },
      ],
      {
        general: {
          decision: "targets",
          eventId,
          observedEventName: eventName,
          reason: "Captured identity support",
          evidenceIds: ["s2-e1"],
          previousEdition: null,
          currentOrNextEdition: {
            editionKey: "2027",
            reason: "Captured Edition selection",
            evidenceIds: ["s2-e2", "s2-e3"],
            fields: {
              year: setField(
                2027,
                "The official programme identifies this as Harbor Echo Castlewellan 2027.",
                ["s2-e2", "s2-e3"],
              ),
              dates: setField(
                {
                  startsOn: "2027-01-23",
                  endsOn: "2027-01-30",
                  state: "confirmed",
                },
                "The official programme confirms the festival dates as 23–30 January 2027.",
                ["s2-e2", "s2-e3"],
              ),
              scheduleStatus: setField(
                "scheduled",
                "The official programme publishes the 2027 programme and confirmed dates.",
                ["s2-e2", "s2-e3"],
              ),
              displayName: setField(
                "Harbor Echo Castlewellan 2027",
                "This is the edition heading on the official programme.",
                ["s2-e2", "s2-e3"],
              ),
            },
          },
          checks: [],
          unresolved: [],
        },
        tickets: emptyTicketsReply(),
        classification: {
          description: setField(
            "An outdoor music festival held at Castlewellan Grounds in Northern Ireland.",
            "The official programme describes outdoor music at Castlewellan Grounds.",
            ["s2-e1", "s2-e2"],
          ),
          previousEdition: null,
          currentOrNextEdition: {
            classification: setField(
              {
                eventType: "festival",
                format: "openair",
                topics: ["music"],
                genres: [],
                cultures: [],
              },
              "The official programme describes a festival with a confirmed outdoor music programme. These supported terms form the classification for this edition.",
              ["s2-e2"],
            ),
          },
          checks: [],
          unresolved: [],
        },
        links: {
          event: {
            socials: {},
            website: setField(
              "https://harborechofestival.co.uk/",
              "Captured official source association",
              ["s2-e1"],
            ),
          },
          currentOrNextEdition: {},
          omitted: [],
          checks: [],
          unresolved: [],
        },
      },
    ),
  },
  evaluate: (context) => {
    const { changes, report } = context;
    return [
      officialWebsite(changes, ["https://harborechofestival.co.uk/"]),
      ...researchDidNotFail(report),
      ...editionSlots(context, null, "2027"),
    ];
  },
};
