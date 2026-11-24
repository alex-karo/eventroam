import type { ReaderSelectionOutput } from "../../../roles/reader/contracts";
import type { RegressionPipelineCaseFile } from "../../fixtures";
import { refreshInput, sourceReplay } from "../fixture";

const pageUrl = "https://size-fixture.example/festival";
const eventId = "size-event";
type SizeEvent = RegressionPipelineCaseFile["initial"]["event"];
type SizeEdition = SizeEvent["editions"][number];

const savedProgramme: Pick<
  SizeEdition,
  | "editionYear"
  | "dateState"
  | "scheduleStatus"
  | "countryCode"
  | "venueName"
  | "termIds"
> = {
  editionYear: 2026,
  dateState: "confirmed",
  scheduleStatus: "scheduled",
  countryCode: "PT",
  venueName: "River Grounds",
  termIds: ["validation:festival", "validation:openair", "validation:music"],
};

const riverFestival: SizeEvent = {
  id: eventId,
  slug: "size-evidence",
  canonicalName: "River Festival",
  links: [{ kind: "official_site", url: pageUrl, official: true }],
  editions: [
    {
      ...savedProgramme,
      id: "size-historical",
      editionKey: "historical",
      startsOn: "2026-10-10",
      endsOn: "2026-10-12",
      sizeEstimate: null,
    },
    {
      ...savedProgramme,
      id: "size-unknown",
      editionKey: "unknown",
      startsOn: "2026-11-01",
      endsOn: "2026-11-03",
      sizeEstimate: 6000,
    },
  ],
};

const readerProgramme: Pick<
  ReaderSelectionOutput,
  "overview" | "topics" | "statedYears" | "limitations"
> = {
  overview: "The official page describes River Festival and its programme.",
  topics: [
    "identity",
    "description",
    "location",
    "dates",
    "status",
    "size",
    "classification",
    "tickets",
    "links",
  ],
  statedYears: ["2025", "2026"],
  limitations: [],
};

export const programmeEvidence: ReaderSelectionOutput["evidence"] = [
  {
    quote: 2,
    topics: ["identity", "description", "location"],
  },
  {
    quote: 3,
    topics: ["dates", "status", "size"],
  },
  {
    quote: 4,
    topics: ["dates", "status", "size"],
  },
  {
    quote: 5,
    topics: ["classification"],
  },
];

export function sizeHistoryFixture(
  { id, task, note }: { id: string; task: string; note: string },
  markdownFile: string,
  reader: Pick<ReaderSelectionOutput, "coverage" | "evidence">,
  descriptions: Pick<SizeEvent, "description" | "shortDescription"> = {},
): RegressionPipelineCaseFile {
  return {
    id,
    suite: "regression",
    origin: "synthetic",
    task,
    todayUtc: "2026-10-31",
    input: refreshInput(eventId, "full"),
    provenance: { kind: "synthetic-size-regression", note },
    initial: { event: { ...riverFestival, ...descriptions } },
    sources: [
      sourceReplay(pageUrl, "2026-10-31T12:00:00Z", markdownFile, {
        readerOutput: { ...readerProgramme, ...reader },
      }),
    ],
  };
}
