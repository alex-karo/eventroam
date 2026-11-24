import { officialWebsite, confirmedDates, preserveDates } from "../../changes";
import type { RegressionCaseDefinition } from "../../regression";
import { researchDidNotFail } from "../../research";
import { check } from "../../checks";
import { fixedHandoff, readerSelection, passage, setField } from "./fixture";
import { refreshInput, sourceReplay } from "../fixture";

const eventId = "event:792d44feb71838d4b28b";
const eventName = "Wacken Open Air";

export const editorWrongYearCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: {
    id: "editor-wrong-year",
    suite: "regression",
    origin: "synthetic",
    task: "Check editor wrong year",
    input: refreshInput(eventId),
    initial: {
      event: {
        id: eventId,
        slug: "wacken-open-air-792d44fe",
        canonicalName: eventName,
        links: [
          {
            kind: "other",
            url: "https://www.wacken.com/",
            label: "Website (unverified)",
            official: false,
          },
        ],
        editions: [
          {
            id: "edition:792d44feb71838d4b28b",
            editionKey: "source-row",
            editionYear: 2026,
            startsOn: "2026-07-30",
            endsOn: "2026-08-01",
            dateState: "confirmed",
            scheduleStatus: "scheduled",
            countryCode: "DE",
            termIds: [],
          },
        ],
      },
    },
    sources: [
      sourceReplay(
        "https://www.wacken.com/",
        "2026-10-03T16:33:58.662Z",
        "../wacken/page.md",
        { finalUrl: "https://www.wacken.com/de/" },
      ),
      sourceReplay(
        "https://www.wacken.com/de/tickets-shop/ticket-uebersicht-2027/",
        "2026-10-03T23:49:31.171Z",
        "../wacken/tickets.md",
      ),
      sourceReplay(
        "https://www.wacken.com/de/camping-travel/die-uebersicht/",
        "2026-10-03T23:49:31.172Z",
        "../wacken/travel.md",
      ),
    ],
    provenance: {
      kind: "captured-source-editor-regression",
      note: "Reuses captured pages with controlled saved catalog state. Unavailable injects retrieval failure; clear truncates captured contact text to its office section. Editor input now uses fixed source-backed Reader passages and explicit proposal citations. Research and Reader do not call a model.",
    },
    roleHandoff: fixedHandoff(
      "Captured editor-wrong-year research from openspec/changes/ingestion-editor/evaluation/final-full-rerun.json; openai/gpt-6-luna, editor-findings-v1; 2026-10-11T23:36:14.179Z; classification migrated to editor-findings-v2 complete-list contract. Adapted to fixed domain roles. The Edition ticket link uses the inspected overview. The YouTube link uses the cited official URL. Fixed Reader passages are copied from source-backed artifacts from the standard-tier 2026-11-02 run. Captures: 10a5037c-f9d1-46f1-a78c-7ac924784f80:s1, 10a5037c-f9d1-46f1-a78c-7ac924784f80:s2, 10a5037c-f9d1-46f1-a78c-7ac924784f80:s3. Collection reads only the fixed pages. Captured proposals have explicit citations and retain their unchecked findings; they make no new claim of complete research. No model is called for Research, Reader or the captured specialists. Editor and eligible Location still run. Legacy retrieval-gap wording was changed to describe the fixed input coverage; no new retrieval failure is asserted. Page-coverage lists are empty because these fixed inputs test Editor, not Research navigation.",
      [
        {
          url: "https://www.wacken.com/",
          sourceId: "s1",
          reader: readerSelection({
            overview:
              "Wacken Open Air (W:O:A) is a Heavy Metal festival. The official page promotes W:O:A 2027 tickets, but this page provides no festival dates, location, or details of the latest completed edition.",
            topics: ["identity", "description", "status", "tickets", "links"],
            statedYears: ["2027", "2026"],
            limitations: [
              "The page does not state W:O:A 2027 dates or location, identify the latest completed W:O:A edition, or give an attendee count or ticket prices. Ticket links are provided, but no ticket terms or availability details are stated.",
              "Quotation 3 or its context has no unique literal match",
              "Quotation 4 or its context has no unique literal match",
              "Quotation 5 or its context has no unique literal match",
              "Quotation 6 or its context has no unique literal match",
              "Quotation 7 or its context has no unique literal match",
            ],
            evidence: [
              passage([3, 4], "identity", "description"),
              passage(18, "identity", "links"),
              passage(58, "tickets", "links"),
              passage(72, "status", "tickets", "links"),
              passage([13, 14], "links"),
              passage([31, 34], "links"),
              passage(99, "identity", "links"),
            ],
          }),
        },
        {
          url: "https://www.wacken.com/de/tickets-shop/ticket-uebersicht-2027/",
          sourceId: "s2",
          reader: readerSelection({
            overview:
              "Wacken Open Air is a metal festival. This official ticket page announces the 2027 festival for July 28–31 and lists LOUDER, YOUNGER and The Pit ticket offers.",
            topics: ["identity", "dates", "tickets", "links"],
            statedYears: ["2027"],
            limitations: [
              "This ticket page does not establish the latest completed festival, participant count, or festival grounds/location.",
            ],
            evidence: [
              passage(40, "identity", "dates", "links"),
              {
                quote: { start: 41, end: 84 },
                topics: ["identity", "tickets"],
                context: [40],
                editionClues: [],
                uncertainty: null,
              },
              passage([85, 86], "tickets", "location", "links"),
              passage([35, 39], "links"),
            ],
          }),
        },
        {
          url: "https://www.wacken.com/de/camping-travel/die-uebersicht/",
          sourceId: "s3",
          reader: readerSelection({
            overview:
              "This official Wacken Open Air camping page describes camping options and areas on the festival grounds. It does not state festival dates, attendance, general admission ticket details, or the latest completed or next festival edition.",
            topics: ["identity", "description", "location", "links"],
            statedYears: ["2027", "2026"],
            limitations: [
              "The page is about camping; it does not identify a completed or upcoming festival edition or provide its dates or status.",
              "No participant count or general festival-admission price or offer is stated. Links to 2027 ticket pages appear in site navigation and footer, but this page gives no ticket details.",
              "Quotation 13 or its context has no unique literal match",
            ],
            evidence: [
              passage([42, 43], "identity", "description"),
              passage(45, "description", "location"),
              passage([46, 47], "description"),
              passage([48, 49], "description"),
              passage([50, 51], "description", "location"),
              passage([52, 53], "description", "location"),
              passage([54, 55], "description", "location"),
              passage([57, 58], "description", "location"),
              passage([60, 61], "description", "location", "links"),
              passage([62, 63], "description", "tickets"),
              passage(18, "identity", "links"),
              passage([37, 39], "links"),
              passage(87, "links"),
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
          evidenceIds: [
            "s1-e1",
            "s1-e2",
            "s1-e7",
            "s2-e1",
            "s2-e2",
            "s3-e1",
            "s3-e11",
          ],
          previousEdition: {
            editionKey: "source-row",
            reason: "Captured Edition selection",
            evidenceIds: ["s2-e1"],
            fields: {
              year: setField(
                2026,
                "The official homepage references the W:O:A 2026 aftermovie and describes 2026 as the festival’s 35th anniversary edition; this verifies the saved edition year, but not its dates or other saved details.",
                ["s2-e1"],
              ),
            },
          },
          currentOrNextEdition: {
            editionKey: "wacken-open-air-2027",
            reason: "Captured Edition selection",
            evidenceIds: ["s1-e4", "s2-e1"],
            fields: {
              year: setField(
                2027,
                "The official ticket overview is specifically for Wacken Open Air 2027.",
                ["s1-e4", "s2-e1"],
              ),
              dates: setField(
                {
                  startsOn: "2027-07-28",
                  endsOn: "2027-07-31",
                  state: "confirmed",
                },
                "The official 2027 ticket overview displays 28–31 July 2027.",
                ["s2-e1"],
              ),
              scheduleStatus: setField(
                "scheduled",
                "The official site presents dated 2027 festival tickets for sale.",
                ["s1-e4", "s2-e1"],
              ),
            },
          },
          checks: [],
          unresolved: [
            {
              message:
                "The fixed sources identify the 2026 Edition but do not establish its dates or place. Those saved values remain unchecked.",
              editionKey: "source-row",
            },
            {
              message:
                "The fixed ticket overview lists the 2027 offers, but the fixed inputs do not establish their availability.",
              editionKey: "wacken-open-air-2027",
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
                    label: "Louder-Ticket",
                    amount: 364,
                    currency: "EUR",
                    terms: "Plus €2 ticket fee.",
                    availability: "unknown",
                  },
                  {
                    label: "Younger-Ticket",
                    amount: 279,
                    currency: "EUR",
                    terms:
                      "Discounted ticket for attendees up to and including age 25 at the start of the festival; plus €2 ticket fee.",
                    availability: "unknown",
                  },
                  {
                    label: "The Pit-Ticket",
                    amount: 1399,
                    currency: "EUR",
                    availability: "unknown",
                  },
                  {
                    label: "The Pit Upgrade",
                    amount: 1049,
                    currency: "EUR",
                    terms:
                      "Upgrade for holders of a W:O:A 2027 ticket; not a standalone festival admission ticket.",
                    availability: "unknown",
                  },
                ],
                basePrice: {
                  kind: "exact",
                  currency: "EUR",
                  minAmount: 364,
                  maxAmount: 364,
                  coverage: "full_programme",
                  qualification:
                    "Louder-Ticket price; €2 ticket fee is additional.",
                },
              },
              "The official overview publishes these ticket prices and identifies the Younger ticket as age-restricted. The fixed inputs contain no ticket-shop content, so availability remains unknown.",
              ["s1-e3", "s1-e4", "s2-e2", "s2-e3", "s3-e10"],
            ),
          },
          checks: [],
          unresolved: [],
        },
        classification: {
          description: setField(
            "Wacken Open Air is a heavy metal festival in Wacken, Germany.",
            "The official homepage identifies Wacken Open Air and describes its concerts and metal community.",
            [
              "s1-e1",
              "s2-e1",
              "s3-e1",
              "s3-e2",
              "s3-e3",
              "s3-e4",
              "s3-e5",
              "s3-e6",
              "s3-e7",
              "s3-e8",
              "s3-e9",
              "s3-e10",
            ],
          ),
          previousEdition: {},
          currentOrNextEdition: {
            classification: setField(
              {
                eventType: "festival",
                format: "openair",
                topics: ["music"],
                genres: ["metal"],
                cultures: [],
              },
              "The official pages describe the event as Wacken Open Air and promote four days of concerts in a metal community.",
              [
                "s1-e1",
                "s3-e1",
                "s3-e2",
                "s3-e3",
                "s3-e4",
                "s3-e5",
                "s3-e6",
                "s3-e7",
                "s3-e8",
                "s3-e9",
                "s3-e10",
              ],
            ),
          },
          checks: [],
          unresolved: [],
        },
        links: {
          event: {
            socials: {
              youtube: setField(
                "https://www.youtube.com/wackentv/",
                "The official Wacken homepage links to this channel.",
                ["s1-e6"],
              ),
            },
            website: setField(
              "https://www.wacken.com/de/",
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
                "s3-e9",
                "s3-e11",
                "s3-e12",
                "s3-e13",
              ],
            ),
          },
          currentOrNextEdition: {
            tickets: setField(
              "https://www.wacken.com/de/tickets-shop/ticket-uebersicht-2027/",
              "The official overview lists the admission options for Wacken Open Air 2027.",
              ["s2-e1", "s2-e2"],
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
        "https://www.wacken.com/de/",
        "https://www.wacken.com/en/",
        "https://www.wacken.com/",
      ]),
      ...confirmedDates(changes, { year: 2027 }, "2027-07-28", "2027-07-31"),
      check(
        "catalog.edition.2027.country_code.preserve.1",
        !changes.edition(
          { year: 2027 },
          "country_code",
          (value) => value !== "DE" && value != null,
        ),
        'Keep 2027 country equal to "DE" when supplied',
      ),
      ...preserveDates(changes, "source-row"),
      ...researchDidNotFail(report),
    ];
  },
};
