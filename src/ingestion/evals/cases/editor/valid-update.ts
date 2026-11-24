import { officialWebsite, confirmedDates, preserveDates } from "../../changes";
import type { RegressionCaseDefinition } from "../../regression";
import { researchDidNotFail } from "../../research";
import { check } from "../../checks";
import { fixedHandoff, readerSelection, passage, setField } from "./fixture";
import { refreshInput, sourceReplay } from "../fixture";

const eventId = "event:a22324dcf0078266ed4e";
const eventName = "Sziget Festival";

export const editorValidUpdateCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: {
    id: "editor-valid-update",
    suite: "regression",
    origin: "synthetic",
    task: "Check editor valid update",
    input: refreshInput(eventId),
    initial: {
      event: {
        id: eventId,
        slug: "sziget-festival-a22324dc",
        canonicalName: eventName,
        links: [
          {
            kind: "other",
            url: "https://www.szigetfestival.com/",
            label: "Website (unverified)",
            official: false,
          },
        ],
        editions: [
          {
            id: "edition:a22324dcf0078266ed4e",
            editionKey: "source-row",
            editionYear: 2026,
            startsOn: "2026-08-11",
            endsOn: "2026-08-15",
            dateState: "confirmed",
            scheduleStatus: "scheduled",
            countryCode: "HU",
            termIds: [],
          },
        ],
      },
    },
    sources: [
      sourceReplay(
        "https://www.szigetfestival.com/",
        "2026-10-03T16:33:58.662Z",
        "../sziget/page.md",
        { finalUrl: "https://szigetfestival.com/en/" },
      ),
      sourceReplay(
        "https://szigetfestival.com/en/tickets",
        "2026-10-03T23:16:38.705Z",
        "../sziget/tickets.md",
        { reasonCode: "renders_budget_exhausted" },
      ),
      sourceReplay(
        "https://szigetfestival.com/en/travel",
        "2026-10-03T23:14:50.663Z",
        "../sziget/travel.md",
        { finalUrl: "https://szigetfestival.com/en/travel/" },
      ),
      sourceReplay(
        "https://szigetfestival.com/en/festival-info",
        "2026-10-03T23:49:32.520Z",
        "../sziget/info.md",
      ),
    ],
    provenance: {
      kind: "captured-source-editor-regression",
      note: "Reuses captured pages with controlled saved catalog state. Unavailable injects retrieval failure; clear truncates captured contact text to its office section. Editor input now uses fixed source-backed Reader passages and explicit proposal citations. Research and Reader do not call a model.",
    },
    roleHandoff: fixedHandoff(
      "Captured editor-valid-update research from openspec/changes/ingestion-editor/evaluation/final-full-rerun.json; openai/gpt-6-luna, editor-findings-v1; 2026-10-11T23:36:14.179Z; classification migrated to editor-findings-v2 complete-list contract. Adapted to fixed domain roles. Fixed Reader selections use source-backed artifacts from the standard-tier 2026-11-02 run. Some excerpts extend to source segment boundaries. Captures: 17470331-0d9d-443d-8f60-3f8532d2d3d5:s1, 17470331-0d9d-443d-8f60-3f8532d2d3d5:s2, 17470331-0d9d-443d-8f60-3f8532d2d3d5:s8, 17470331-0d9d-443d-8f60-3f8532d2d3d5:s3. Collection reads only the fixed pages. Captured proposals have explicit citations and retain their unchecked findings; they make no new claim of complete research. No model is called for Research, Reader or the captured specialists. Editor and eligible Location still run. Legacy retrieval-gap wording was changed to describe the fixed input coverage; no new retrieval failure is asserted. Page-coverage lists are empty because these fixed inputs test Editor, not Research navigation.",
      [
        {
          url: "https://www.szigetfestival.com/",
          sourceId: "s1",
          reader: readerSelection({
            overview:
              "Sziget Festival is promoted as “The Island of Freedom.” The homepage looks back on 2026 and advertises 2027 passes for 10–14 August; it does not state a 2026 date, venue address or programme details.",
            topics: [
              "identity",
              "description",
              "dates",
              "status",
              "size",
              "tickets",
              "classification",
              "location",
              "links",
            ],
            statedYears: ["2027", "2026", "2025"],
            limitations: [
              "The page does not give exact dates or a venue address for the completed 2026 festival, or a programme description, genres or participant count; “hundreds of thousands” is an unspecific attendee claim.",
              "The page’s title, navigation and ticket offer point to 2027, while its metadata description says “Sziget Festival 2026 Budapest.” The metadata does not establish 2026 dates or venue.",
              "Quotation 6 or its context has no unique literal match",
            ],
            evidence: [
              passage([24, 25], "identity", "status", "links"),
              passage(13, "dates", "status", "links"),
              passage([27, 40], "tickets", "dates", "links"),
              passage([41, 43], "description", "status", "size", "links"),
              {
                quote: { start: 3, end: 6 },
                topics: ["identity", "description", "location", "dates"],
                context: [],
                editionClues: [],
                uncertainty:
                  "Metadata conflicts on the festival year: the description names 2026, while the Open Graph title names 2027. The page’s title and promotional content identify the advertised edition as 2027.",
              },
              passage(161, "links"),
              passage(16, "description", "links"),
            ],
          }),
        },
        {
          url: "https://szigetfestival.com/en/tickets",
          sourceId: "s2",
          reader: readerSelection({
            overview:
              "The official Sziget tickets page is titled “Tickets - #SZIGET2027” and shows festival dates of 10–14 August 2027. The retrieved page contains no ticket offers or prices.",
            topics: ["identity", "dates", "tickets", "links"],
            statedYears: ["2027"],
            limitations: [
              "The page retrieval contains no ticket offers, prices, participant count, festival location, programme or information about the latest completed festival.",
              "Quotation 3 or its context has no unique literal match",
              "Quotation 4 or its context has no unique literal match",
            ],
            evidence: [
              passage(2, "identity"),
              passage(10, "dates", "links"),
              passage(13, "description", "links"),
              passage(38, "links"),
            ],
          }),
        },
        {
          url: "https://szigetfestival.com/en/travel",
          sourceId: "s3",
          reader: readerSelection({
            overview:
              "Sziget Festival is held on Óbuda Island in Budapest. The page announces 10–14 August 2027, but also contains travel promotions referring to 2026; it provides no participant count, programme details or admission prices.",
            topics: ["identity", "description", "dates", "location", "links"],
            statedYears: ["2027", "2026"],
            limitations: [
              "This travel page does not establish the latest completed festival or provide programme details, participant counts, or admission offers and prices. The 2026 references concern travel promotions, not a clear festival-date announcement.",
              "Quotation 5 or its context has no unique literal match",
            ],
            evidence: [
              {
                quote: 11,
                topics: ["dates", "links"],
                context: [2],
                editionClues: [],
                uncertainty:
                  "The page header announces 2027 dates, while other travel promotions on the page refer to 2026.",
              },
              passage([26, 27], "identity", "location"),
              passage(7, "identity"),
              passage([39, 41], "description", "location"),
              passage(91, "links"),
              passage(88, "links"),
              {
                quote: 48,
                topics: ["dates"],
                context: [],
                editionClues: [],
                uncertainty:
                  "This is a travel-promotion deadline, not a festival date.",
              },
            ],
          }),
        },
        {
          url: "https://szigetfestival.com/en/festival-info",
          sourceId: "s4",
          reader: readerSelection({
            overview:
              "Sziget Festival’s official FAQ identifies the 2027 edition as August 10–14 and says artists will be announced later. It gives no festival location or participant count; ticket-buying information is provided, but no 2027 prices or offers are specified.",
            topics: [
              "identity",
              "description",
              "dates",
              "status",
              "tickets",
              "links",
            ],
            statedYears: ["2027", "2026", "2025", "2024"],
            limitations: [
              "The page does not state a participant count or festival venue/location.",
              "No 2027 ticket prices or specific admission offers are stated; ticket terms elsewhere on the page refer to other editions or are not clearly edition-specific.",
              "The page does not identify the latest actually completed festival edition.",
              "Quotation 3 or its context has no unique literal match",
            ],
            evidence: [
              {
                quote: { start: 22, end: 39 },
                topics: ["identity", "description", "dates", "status", "links"],
                context: [],
                editionClues: [],
                uncertainty:
                  "The 2027 FAQ section gives dates and says performers will be announced later, but does not name a venue or describe the programme beyond this.",
              },
              passage(42, "tickets", "links", "location"),
              passage(11, "dates", "links"),
              passage(241, "links"),
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
          evidenceIds: ["s1-e1", "s1-e5", "s2-e1", "s3-e2", "s3-e3", "s4-e1"],
          previousEdition: {
            editionKey: "source-row",
            reason: "Captured Edition selection",
            evidenceIds: ["s1-e1", "s1-e4", "s1-e5", "s3-e7"],
            fields: {
              year: setField(
                2026,
                "The official FAQ refers to Sziget 2026 in information about festival operations, confirming the saved edition year.",
                ["s1-e1", "s1-e4", "s1-e5", "s3-e7"],
              ),
            },
          },
          currentOrNextEdition: {
            editionKey: "2027",
            reason: "Captured Edition selection",
            evidenceIds: [
              "s1-e2",
              "s1-e3",
              "s1-e5",
              "s2-e2",
              "s3-e1",
              "s4-e1",
              "s4-e3",
            ],
            fields: {
              year: setField(
                2027,
                "The official homepage and FAQ announce Sziget Festival 2027.",
                ["s1-e2", "s1-e3", "s1-e5", "s2-e2", "s3-e1", "s4-e1", "s4-e3"],
              ),
              dates: setField(
                {
                  startsOn: "2027-08-10",
                  endsOn: "2027-08-14",
                  state: "confirmed",
                },
                "The official homepage and FAQ give the festival dates as 10–14 August 2027.",
                ["s1-e2", "s1-e3", "s1-e5", "s2-e2", "s3-e1", "s4-e1", "s4-e3"],
              ),
              scheduleStatus: setField(
                "scheduled",
                "The official site says Sziget returns on the confirmed 2027 dates and is selling passes for that edition.",
                ["s1-e2", "s1-e3", "s1-e5", "s2-e2", "s3-e1", "s4-e1", "s4-e3"],
              ),
            },
          },
          checks: [],
          unresolved: [
            {
              message:
                "The fixed ticket-page capture omits offer listings. The fixed sources establish the quoted homepage offers but do not establish additional categories or their availability.",
              editionKey: "2027",
              field: "tickets",
            },
          ],
        },
        tickets: {
          currentOrNextEdition: {
            tickets: setField(
              {
                variants: [
                  {
                    label: "5-day Pass",
                    amount: 349,
                    currency: "EUR",
                    terms: "€23 online handling fee additional",
                    availability: "unknown",
                  },
                  {
                    label: "21&Under 5-day Pass",
                    amount: 279,
                    currency: "EUR",
                    terms:
                      "For ticket holders aged 21 and under; €18 online handling fee additional",
                    availability: "unknown",
                  },
                  {
                    label: "VIP 5-day Pass",
                    amount: 569,
                    currency: "EUR",
                    terms: "€37 online handling fee additional",
                    availability: "unknown",
                  },
                ],
                basePrice: {
                  kind: "exact",
                  currency: "EUR",
                  minAmount: 349,
                  maxAmount: 349,
                  coverage: "full_programme",
                  qualification:
                    "5-day Pass; €23 online handling fee additional",
                },
              },
              "The official homepage lists these three 2027 pass categories and prices. The 21&Under pass is eligibility-restricted; the 5-day Pass is the lowest-priced unrestricted full-programme pass.",
              ["s1-e3", "s4-e2"],
            ),
          },
          checks: [],
          unresolved: [],
        },
        classification: {
          previousEdition: {},
          currentOrNextEdition: {
            classification: setField(
              {
                eventType: "festival",
                format: null,
                topics: ["music"],
                genres: [],
                cultures: [],
              },
              "The official site identifies Sziget as a festival and describes its programme as including music; the FAQ also refers to more than 500 artists.",
              ["s1-e4", "s1-e5", "s1-e7", "s2-e3", "s3-e4", "s4-e1"],
            ),
          },
          checks: [],
          unresolved: [],
        },
        links: {
          event: {
            socials: {},
            website: setField(
              "https://szigetfestival.com/en/",
              "Captured official source association",
              [
                "s1-e1",
                "s1-e2",
                "s1-e3",
                "s1-e4",
                "s1-e5",
                "s1-e6",
                "s1-e7",
                "s2-e1",
                "s2-e2",
                "s2-e3",
                "s2-e4",
                "s3-e1",
                "s3-e2",
                "s3-e3",
                "s3-e5",
                "s3-e6",
                "s4-e1",
                "s4-e2",
                "s4-e3",
                "s4-e4",
              ],
            ),
          },
          currentOrNextEdition: {
            tickets: setField(
              "https://szigetfestival.com/en/tickets",
              "Captured official source association",
              ["s1-e3", "s4-e2"],
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
      officialWebsite(changes, [
        "https://szigetfestival.com/en/",
        "https://www.szigetfestival.com/",
        "https://szigetfestival.com/",
      ]),
      ...confirmedDates(changes, { year: 2027 }, "2027-08-10", "2027-08-14"),
      check(
        "catalog.edition.2027.venue_address",
        changes.edition(
          { year: 2027 },
          "venue_address",
          (value) =>
            typeof value === "string" &&
            /\b1033\b/.test(value) &&
            /Budapest/i.test(value) &&
            /m[áa]jus\s+9\.?\s+park/i.test(value),
        ),
        "Save the festival site address at Május 9. park, Budapest 1033",
      ),
      ...preserveDates(changes, "source-row"),
      ...researchDidNotFail(report),
    ];
  },
};
