import type { RegressionCaseDefinition } from "../../regression";
import { researchDidNotFail } from "../../research";
import { check } from "../../checks";
import { fixedHandoff, readerSelection, passage, setField } from "./fixture";
import { emptyTicketsReply } from "../empty-replies";
import { refreshInput, sourceReplay } from "../fixture";

const eventId = "event:87b1f34093d76b709011";
const eventName = "Roskilde Festival";
const homePage = "https://www.roskilde-festival.dk/";

export const editorClearCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: {
    id: "editor-clear",
    suite: "regression",
    origin: "synthetic",
    task: "Replace a saved office address with the festival address",
    input: refreshInput(eventId, "current"),
    initial: {
      event: {
        id: eventId,
        slug: "roskilde-festival-87b1f340",
        canonicalName: eventName,
        links: [
          {
            kind: "other",
            url: homePage,
            label: "Website (unverified)",
            official: false,
          },
        ],
        editions: [
          {
            id: "edition:87b1f34093d76b709011",
            editionKey: "source-row",
            editionYear: 2027,
            startsOn: "2027-06-26",
            endsOn: "2027-07-03",
            dateState: "confirmed",
            scheduleStatus: "scheduled",
            countryCode: "DK",
            termIds: [],
            venueAddress: "Rabalderstræde 7, 4.",
          },
        ],
      },
    },
    sources: [
      sourceReplay(homePage, "2026-10-03T16:33:58.662Z", "../roskilde/page.md"),
      sourceReplay(
        "https://www.roskilde-festival.dk/kontakt",
        "2026-10-30T01:31:56.361Z",
        "../roskilde/contact.md",
      ),
    ],
    provenance: {
      kind: "captured-source-editor-regression",
      note: "This case uses captured Roskilde pages and a saved office address. A fixed Location reply proposes the festival address and cites the two address passages separately.",
    },
    roleHandoff: fixedHandoff(
      "Captured editor-clear research from openspec/changes/ingestion-editor/evaluation/final-full-rerun.json; openai/gpt-6-luna, editor-findings-v1; 2026-10-11T23:36:14.179Z; classification migrated to editor-findings-v2 complete-list contract; Event link finding removed for current scope. Adapted to fixed domain roles. The homepage selections use capture 6573f83d-d4a9-4865-af49-73b3f5c1b160:s1. The full contact page from the Roskilde case supplies the office and festival address passages. The fixed Location reply uses both passages. Only Editor calls a model.",
      [
        {
          url: homePage,
          sourceId: "s1",
          reader: readerSelection({
            overview:
              "Roskilde Festival 2027 is announced for 26 June–3 July, with ticket sales underway and the first 18 programme names announced. The festival describes itself as independent and non-profit.",
            topics: [
              "identity",
              "description",
              "dates",
              "status",
              "tickets",
              "classification",
              "links",
            ],
            statedYears: ["2027", "2026"],
            limitations: [
              "The homepage gives no participant count, venue or festival-site location, or detailed programme genres. Its “Seneste nyt” section includes a 22.10.2026 item, later than the source retrieval date of 2026-10-03; that item is not relied on for the current ticket-status claim.",
              "No identity contradiction is apparent: the source title and content identify Roskilde Festival.",
            ],
            evidence: [
              passage([28, 30], "status", "tickets", "links"),
              passage(9, "dates", "identity", "links"),
              passage(4, "dates", "description", "identity", "tickets"),
              passage(
                35,
                "classification",
                "size",
                "dates",
                "tickets",
                "links",
              ),
              passage([14, 15], "tickets", "links"),
              passage([21, 23], "links"),
            ],
          }),
        },
        {
          url: "https://www.roskilde-festival.dk/kontakt",
          sourceId: "s2",
          reader: readerSelection({
            overview:
              "The contact page identifies Roskilde Festival, links to the 2027 festival and gives separate office and festival addresses.",
            topics: ["identity", "dates", "location", "links"],
            statedYears: ["2027"],
            limitations: [
              "The contact page gives links to ticket and programme information.",
            ],
            evidence: [
              passage(9, "dates", "links"),
              passage([28, 29], "identity", "description"),
              passage([14, 15], "links"),
              passage([41, 44], "location"),
              passage([45, 49], "location"),
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
          evidenceIds: ["s1-e2", "s1-e3", "s2-e2"],
          previousEdition: null,
          currentOrNextEdition: {
            editionKey: "source-row",
            reason: "Captured Edition selection",
            evidenceIds: ["s1-e2", "s1-e3", "s2-e1"],
            fields: {
              year: setField(
                2027,
                "The official homepage labels the upcoming edition RF27 and displays its dates in 2027.",
                ["s1-e2", "s1-e3", "s2-e1"],
              ),
              dates: setField(
                {
                  startsOn: "2027-06-26",
                  endsOn: "2027-07-03",
                  state: "confirmed",
                },
                "The official homepage displays “26/6 – 3/7 2027,” confirming the edition dates.",
                ["s1-e2", "s1-e3", "s2-e1"],
              ),
              scheduleStatus: setField(
                "scheduled",
                "The official homepage advertises RF27, says ticket sales are underway, and displays its 2027 dates.",
                ["s1-e2", "s1-e3", "s2-e1"],
              ),
            },
          },
          checks: [],
          unresolved: [
            {
              message:
                "The fixed inputs do not establish the full 2027 ticket block, categories, prices or availability.",
              editionKey: "source-row",
              field: "tickets",
            },
            {
              message:
                "The fixed inputs provide no detailed 2027 programme for a full classification check.",
              editionKey: "source-row",
              field: "classification",
            },
          ],
        },
        tickets: emptyTicketsReply(),
        classification: {
          previousEdition: null,
          currentOrNextEdition: {
            classification: setField(
              {
                eventType: "festival",
                format: null,
                topics: ["music"],
                genres: [],
                cultures: [],
              },
              "The official homepage presents RF27 as a festival and describes its programme as music, with the first artists announced.",
              ["s1-e3", "s1-e4", "s2-e2"],
            ),
          },
          checks: [],
          unresolved: [],
        },
        links: {
          event: { socials: {} },
          currentOrNextEdition: {
            tickets: setField(
              "https://www.roskilde-festival.dk/billetter",
              "Captured official source association",
              ["s1-e1", "s1-e3", "s1-e4", "s1-e5"],
            ),
          },
          omitted: [],
          checks: [],
          unresolved: [],
        },
        location: {
          decision: {
            status: "ready",
            previousEdition: null,
            currentOrNextEdition: {
              fields: {
                venueName: {
                  action: "keep",
                  reason:
                    "The contact page identifies the site by its address.",
                },
                venueAddress: {
                  action: "set",
                  value: "Darupvej 19",
                  reason:
                    "The page lists the saved address for the office. It lists Darupvej 19 for the festival.",
                },
                locality: {
                  action: "set",
                  value: "Roskilde",
                  reason: "The festival address lists 4000 Roskilde.",
                },
                administrativeArea: {
                  action: "keep",
                  reason:
                    "The contact page gives the street address and locality.",
                },
                countryCode: {
                  action: "keep",
                  reason: "The saved Edition is in Denmark.",
                },
              },
              evidenceIds: ["s2-e4", "s2-e5"],
              coordinates: {
                action: "keep",
                reason: "The contact page gives address text.",
              },
              unresolved: [],
            },
          },
        },
      },
    ),
  },
  evaluate: (context) => {
    const { report, changes } = context;
    return [
      check(
        "catalog.edition.source-row.venue_address.set",
        changes.edition(
          { key: "source-row" },
          "venue_address",
          (value) => value === "Darupvej 19",
        ),
        "Replace the saved office address with Darupvej 19",
      ),
      check(
        "catalog.edition.source-row.country_code.preserve.1",
        !changes.edition(
          { key: "source-row" },
          "country_code",
          (value) => value !== "DK",
        ),
        "Preserve the saved country code DK",
      ),
      ...researchDidNotFail(report),
    ];
  },
};
