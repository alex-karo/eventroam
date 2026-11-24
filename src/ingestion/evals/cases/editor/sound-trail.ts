import type { RegressionPipelineCaseFile } from "../../fixtures";
import { refreshInput, sourceReplay } from "../fixture";
import { readerSelection, passage, setField } from "./fixture";

type Handoff = NonNullable<RegressionPipelineCaseFile["roleHandoff"]>;
type GeneralTargets = Extract<
  NonNullable<Handoff["roles"]["general"]>,
  { decision: "targets" }
>;

const eventId = "source-known-offers-blocked-checkout";
const eventName = "Sound Trail";
export const soundTrailHomePage = "https://sound-trail.example/";

export const soundTrailFixture: Pick<
  RegressionPipelineCaseFile,
  "suite" | "origin" | "todayUtc" | "input" | "initial"
> = {
  suite: "regression",
  origin: "synthetic",
  todayUtc: "2026-10-14",
  input: refreshInput(eventId, "current"),
  initial: {
    event: {
      id: eventId,
      slug: eventId,
      canonicalName: eventName,
      links: [
        { kind: "official_site", url: soundTrailHomePage, official: true },
      ],
      editions: [
        {
          id: "source-known-offers-blocked-checkout-edition",
          editionKey: "2027",
          editionYear: 2027,
          startsOn: "2027-01-23",
          endsOn: "2027-01-30",
          dateState: "confirmed",
          scheduleStatus: "scheduled",
          countryCode: "GB",
          termIds: [],
        },
      ],
    },
  },
};

export const soundTrailSource = sourceReplay(
  soundTrailHomePage,
  "2026-10-14T12:00:00Z",
  "../source-regressions/offers.md",
);

export const soundTrailReaderPage: Handoff["pages"][number] = {
  url: soundTrailHomePage,
  sourceId: "s1",
  reader: readerSelection({
    overview:
      "The page identifies Sound Trail as a music festival scheduled for 23–30 January 2027 at Meadow Grounds, York, and describes three admission offers. It does not provide programme details; the all-programme pass price has no stated currency.",
    topics: [
      "identity",
      "description",
      "dates",
      "tickets",
      "location",
      "links",
    ],
    statedYears: ["2027"],
    limitations: [
      "The source gives no festival status beyond describing the 2027 dates as confirmed programme dates.",
      "No participant count or programme details are provided.",
      "Ticket sales availability is not stated. The all-programme pass price is shown as $615.35, but the page gives no country or currency code and says the currency selector is missing.",
      "The assignment requests an identity contradiction, but the saved source contains no conflicting festival identity.",
    ],
    evidence: [
      passage([1, 2], "identity", "description", "dates", "status", "location"),
      passage([4, 5], "tickets"),
      {
        quote: 6,
        topics: ["tickets"],
        context: [],
        editionClues: [],
        uncertainty:
          "The price's currency cannot be determined from the source.",
      },
      passage(7, "links", "tickets"),
      passage(8, "links", "tickets"),
    ],
  }),
};

export function soundTrailGeneral(
  unresolved: GeneralTargets["unresolved"] = [],
): GeneralTargets {
  return {
    decision: "targets",
    eventId,
    observedEventName: eventName,
    reason: "Captured identity support",
    evidenceIds: ["s1-e1"],
    previousEdition: null,
    currentOrNextEdition: {
      editionKey: "2027",
      reason: "Captured Edition selection",
      evidenceIds: ["s1-e1"],
      fields: {
        year: setField(
          2027,
          "The official page is titled “Sound Trail 2027” and gives programme dates in January 2027.",
          ["s1-e1"],
        ),
        dates: setField(
          {
            startsOn: "2027-01-23",
            endsOn: "2027-01-30",
            state: "confirmed",
          },
          "The official page explicitly states that 23–30 January 2027 are confirmed programme dates.",
          ["s1-e1"],
        ),
        scheduleStatus: setField(
          "scheduled",
          "The official page confirms the programme dates for the upcoming festival; this is consistent with the saved scheduled status.",
          ["s1-e1"],
        ),
      },
    },
    checks: [],
    unresolved,
  };
}

export const soundTrailClassification: NonNullable<
  Handoff["roles"]["classification"]
> = {
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
      "The official page describes Sound Trail as a music festival. No specific music genre or substantial outdoor programme is established by the inspected page.",
      ["s1-e1"],
    ),
  },
  checks: [],
  unresolved: [],
};
