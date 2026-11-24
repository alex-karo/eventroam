import { officialWebsite, confirmedDates, preserveDates } from "../../changes";
import type { RegressionCaseDefinition } from "../../regression";
import { researchDidNotFail } from "../../research";
import { check } from "../../checks";
import { fixedHandoff, readerSelection, passage, setField } from "./fixture";
import { refreshInput, sourceReplay } from "../fixture";

const eventId = "event:87b1f34093d76b709011";
const eventName = "Roskilde Festival";
const homePage = "https://www.roskilde-festival.dk/";

export const editorDayTicketCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: {
    id: "editor-day-ticket",
    suite: "regression",
    origin: "synthetic",
    task: "Check editor day ticket",
    input: refreshInput(eventId),
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
            editionYear: 2026,
            startsOn: "2026-06-27",
            endsOn: "2026-07-04",
            dateState: "confirmed",
            scheduleStatus: "scheduled",
            countryCode: "DK",
            termIds: [],
          },
        ],
      },
    },
    sources: [
      sourceReplay(homePage, "2026-10-03T16:33:58.662Z", "../roskilde/page.md"),
      sourceReplay(
        "https://www.roskilde-festival.dk/billetter",
        "2026-10-03T23:49:31.905Z",
        "../roskilde/tickets.md",
      ),
      sourceReplay(
        "https://www.roskilde-festival.dk/kontakt",
        "2026-10-04T00:50:16.361Z",
        "../roskilde/contact.md",
      ),
      sourceReplay(
        "https://www.roskilde-festival.dk/festival-med-formaal",
        "2026-10-03T23:49:31.906Z",
        "../roskilde/purpose.md",
      ),
    ],
    provenance: {
      kind: "captured-source-editor-regression",
      note: "Reuses captured pages with controlled saved catalog state. Unavailable injects retrieval failure; clear truncates captured contact text to its office section. Editor input now uses fixed source-backed Reader passages and explicit proposal citations. Research and Reader do not call a model.",
    },
    roleHandoff: fixedHandoff(
      "Captured editor-day-ticket research from openspec/changes/ingestion-editor/evaluation/final-full-rerun.json; openai/gpt-6-luna, editor-findings-v1; 2026-10-11T23:36:14.179Z; classification migrated to editor-findings-v2 complete-list contract. Adapted to fixed domain roles. Fixed Reader selections use source-backed artifacts from the standard-tier 2026-11-02 run. Some excerpts extend to source segment boundaries. Captures: 17fea566-18fa-40b1-b812-d34db24348d6:s1, 17fea566-18fa-40b1-b812-d34db24348d6:s2, 17fea566-18fa-40b1-b812-d34db24348d6:s4. Collection reads only the fixed pages. Captured proposals have explicit citations and retain their unchecked findings; they make no new claim of complete research. No model is called for Research, Reader or the captured specialists. Editor and eligible Location still run. Legacy retrieval-gap wording was changed to describe the fixed input coverage; no new retrieval failure is asserted. The Partoutbillet passage was restored as a literal quotation from the supplied ticket page. Its captured Reader quotation failed binding; this fixed Editor input now cites the source-backed passage explicitly. The obsolete binding limitation was removed. The Instagram and Facebook links use the cited official URLs. Page-coverage lists are empty because these fixed inputs test Editor, not Research navigation.",
      [
        {
          url: homePage,
          sourceId: "s1",
          reader: readerSelection({
            overview:
              "Roskilde Festival is described as independent and non-profit. The page announces RF27 for 26 June–3 July 2027, ticket offers and the first 18 programme names; it does not give the latest completed festival’s dates or location.",
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
            statedYears: ["2027", "2026"],
            limitations: [
              "This page does not state the latest completed festival’s dates, location, participant count or programme classification/genres. It also does not identify the festival grounds.",
              "Quotation 1 or its context has no unique literal match",
            ],
            evidence: [
              passage(4, "description", "dates", "status", "classification"),
              passage(9, "dates", "links"),
              passage([29, 30], "tickets", "links"),
              passage(35, "dates", "status", "links"),
              passage([13, 25], "links"),
              passage(61, "description", "links"),
              passage(66, "identity", "links"),
              passage(83, "dates", "identity"),
            ],
          }),
        },
        {
          url: "https://www.roskilde-festival.dk/billetter",
          sourceId: "s2",
          reader: readerSelection({
            overview:
              "Roskilde Festival’s official ticket page advertises 2027 admission, including eight-day, day, two-day and installment-plan tickets. It does not state festival grounds, programme details or participant count.",
            topics: ["identity", "dates", "tickets", "links"],
            statedYears: ["2027", "2026"],
            limitations: [
              "This ticket page does not identify the festival location, describe its programme or report participant numbers, or establish the latest completed festival.",
            ],
            evidence: [
              passage(9, "identity", "dates", "links"),
              passage([36, 40], "tickets"),
              passage([41, 45], "tickets"),
              passage([56, 60], "tickets"),
              passage([61, 65], "tickets"),
              passage([66, 70], "tickets"),
              passage([71, 75], "tickets"),
              passage([13, 25], "links"),
              passage([31, 35], "tickets", "dates"),
            ],
          }),
        },
        {
          url: "https://www.roskilde-festival.dk/kontakt",
          sourceId: "s3",
          reader: readerSelection({
            overview:
              "Roskilde Festival’s official contact page gives the 2027 festival dates and festival address, along with official contact and social links. It does not describe the programme, attendance, or tickets.",
            topics: ["identity", "dates", "location", "links"],
            statedYears: ["2027", "2026"],
            limitations: [
              "This contact page does not state the latest completed festival, participant count, admission tickets, or programme details.",
            ],
            evidence: [
              passage(9, "identity", "dates", "links"),
              passage([45, 49], "identity", "location"),
              passage([74, 78], "links"),
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
          evidenceIds: ["s1-e7", "s1-e8", "s2-e1", "s3-e1", "s3-e2"],
          previousEdition: null,
          currentOrNextEdition: {
            editionKey: "rf27",
            reason: "Captured Edition selection",
            evidenceIds: ["s1-e1", "s1-e2", "s2-e1", "s3-e1"],
            fields: {
              year: setField(
                2027,
                "The official homepage displays the 2027 edition dates, and the official ticket page describes its full festival ticket as covering all eight days.",
                ["s1-e1", "s1-e2", "s2-e1", "s3-e1"],
              ),
              dates: setField(
                {
                  startsOn: "2027-06-26",
                  endsOn: "2027-07-03",
                  state: "confirmed",
                },
                "The official homepage displays 26 June–3 July 2027.",
                ["s1-e1", "s1-e2", "s2-e1", "s3-e1"],
              ),
              scheduleStatus: setField(
                "scheduled",
                "The official site displays confirmed 2027 dates and is selling tickets for the edition.",
                ["s1-e1", "s1-e2", "s2-e1", "s3-e1"],
              ),
              displayName: setField(
                "Roskilde Festival 2027",
                "The official homepage identifies the event as Roskilde Festival and displays the 2027 dates.",
                ["s1-e1", "s1-e2", "s2-e1", "s3-e1"],
              ),
            },
          },
          checks: [],
          unresolved: [
            {
              message:
                "The fixed sources do not establish the saved 2026 Edition dates, place or classification. Those checks remain unfinished.",
              editionKey: "source-row",
            },
          ],
        },
        tickets: {
          currentOrNextEdition: {
            tickets: setField(
              {
                variants: [
                  {
                    label: "Two-day ticket",
                    amount: 2230,
                    currency: "DKK",
                    terms: "Price includes ticket fee.",
                    availability: "unknown",
                  },
                  {
                    label: "Wednesday day ticket",
                    amount: 1530,
                    currency: "DKK",
                    terms: "Price includes ticket fee.",
                    availability: "unknown",
                  },
                  {
                    label: "Thursday day ticket",
                    amount: 1530,
                    currency: "DKK",
                    terms: "Price includes ticket fee.",
                    availability: "unknown",
                  },
                  {
                    label: "Friday day ticket",
                    amount: 1530,
                    currency: "DKK",
                    terms: "Price includes ticket fee.",
                    availability: "unknown",
                  },
                  {
                    label: "Saturday day ticket",
                    amount: 1530,
                    currency: "DKK",
                    terms: "Price includes ticket fee.",
                    availability: "unknown",
                  },
                ],
                basePrice: {
                  kind: "exact",
                  currency: "DKK",
                  minAmount: 2650,
                  maxAmount: 2650,
                  coverage: "full_programme",
                  qualification:
                    "Eight-day full festival ticket; price includes ticket fee.",
                },
              },
              "The official ticket page lists the eight-day full ticket at DKK 2,650, the two-day ticket at DKK 2,230 and four day-ticket options at DKK 1,530 each. It provides purchase links but does not establish each ticket category’s availability.",
              [
                "s1-e3",
                "s2-e2",
                "s2-e3",
                "s2-e4",
                "s2-e5",
                "s2-e6",
                "s2-e7",
                "s2-e9",
              ],
            ),
          },
          checks: [],
          unresolved: [],
        },
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
              "The official site presents Roskilde Festival as a festival with music; its 2027 homepage announcement names music performers.",
              ["s1-e1", "s1-e6"],
            ),
          },
          checks: [],
          unresolved: [],
        },
        links: {
          event: {
            socials: {
              instagram: setField(
                "https://www.instagram.com/roskildefestival/",
                "The official Roskilde homepage links to this profile.",
                ["s1-e5"],
              ),
              facebook: setField(
                "https://www.facebook.com/orangefeeling",
                "The official Roskilde homepage links to this page.",
                ["s1-e5"],
              ),
            },
            website: setField(
              homePage,
              "Captured official source association",
              [
                "s1-e2",
                "s1-e3",
                "s1-e4",
                "s1-e5",
                "s1-e6",
                "s1-e7",
                "s1-e8",
                "s2-e1",
                "s2-e8",
                "s3-e1",
                "s3-e2",
                "s3-e3",
              ],
            ),
          },
          currentOrNextEdition: {
            tickets: setField(
              "https://www.roskilde-festival.dk/billetter",
              "Captured official source association",
              ["s1-e3", "s2-e2", "s2-e3", "s2-e4", "s2-e5", "s2-e6", "s2-e7"],
            ),
          },
          omitted: [],
          checks: [],
          unresolved: [],
        },
      },
    ),
  },
  evaluate: (context) => {
    const { report, changes } = context;
    return [
      officialWebsite(changes, ["https://www.roskilde-festival.dk/"]),
      ...confirmedDates(changes, { year: 2027 }, "2027-06-26", "2027-07-03"),
      check(
        "catalog.edition.2027.price_min_minor.set.5",
        changes.edition(
          { year: 2027 },
          "price_min_minor",
          (value) => value === 265000,
        ),
        "Set 2027 base price in minor units to 265000",
      ),
      ...preserveDates(changes, "source-row"),
      check(
        "catalog.edition.2027.venue_address.preserve.3",
        !changes.edition(
          { year: 2027 },
          "venue_address",
          (value) =>
            typeof value === "string" &&
            value
              .toLowerCase()
              .replace(/\s+/g, " ")
              .includes("rabalderstræde") &&
            value != null,
        ),
        "Exclude unsupported venue address for 2027",
      ),
      check(
        "catalog.edition.2027.country_code.preserve.4",
        !changes.edition(
          { year: 2027 },
          "country_code",
          (value) => value !== "DK" && value != null,
        ),
        'Keep 2027 country equal to "DK" when supplied',
      ),
      check(
        "catalog.edition.2027.price_min_minor.preserve.5",
        !changes.edition(
          { year: 2027 },
          "price_min_minor",
          (value) => value === 153000,
        ),
        "Do not set 2027 base price in minor units to 153000",
      ),
      ...researchDidNotFail(report),
    ];
  },
};
