import type { RegressionPipelineCaseFile } from "../../fixtures";
import { refreshInput, sourceReplay } from "../fixture";

type SearchFixture = RegressionPipelineCaseFile;
type SearchEdition = SearchFixture["initial"]["event"]["editions"][number];
type SearchSource = SearchFixture["sources"][number];

export const officialSite = "https://harborechofestival.co.uk/";
export const programmeUrl = `${officialSite}programme`;
const eventId = "search-policy-event";
const todayUtc = "2026-10-15";

const searchNote =
  "Fictional sources isolate search selection; no live website/search fallback.";
export const noPreviousEditionNote = `${searchNote} The source states that no previous Edition exists, so full-scope selection can complete without changing the source-policy assertions.`;

export const castlewellan = {
  locality: "Castlewellan",
  venueName: "Castlewellan Grounds",
};

export function searchPage(
  url: string,
  markdownFile: string,
  overrides?: Pick<Partial<SearchSource>, "status" | "reasonCode">,
) {
  return sourceReplay(url, `${todayUtc}T12:00:00Z`, markdownFile, overrides);
}

export function discovery(url: string, title: string, highlight: string) {
  return [
    {
      queryPattern: ".*",
      candidates: [{ url, title, highlights: [highlight] }],
    },
  ];
}

export const programmeDiscovery = discovery(
  programmeUrl,
  "Harbor Echo official programme",
  "Castlewellan, 23–30 January 2027.",
);

export function harborEchoFixture({
  id,
  task,
  scope,
  savedWebsite,
  year,
  place,
  sources,
  discoveries,
  note = searchNote,
}: Pick<SearchFixture, "id" | "task" | "sources" | "discoveries"> & {
  scope: "current" | "full";
  savedWebsite: string | null;
  year: number;
  place?: Pick<SearchEdition, "locality" | "venueName">;
  note?: string;
}): SearchFixture {
  return {
    id,
    suite: "regression",
    origin: "synthetic",
    task,
    todayUtc,
    provenance: { kind: "synthetic-search-policy", note },
    input: refreshInput(eventId, scope),
    initial: {
      event: {
        id: eventId,
        slug: eventId,
        canonicalName: "Harbor Echo",
        links: savedWebsite
          ? [{ kind: "official_site", url: savedWebsite, official: true }]
          : [],
        editions: [
          {
            id: "search-policy-edition",
            editionKey: String(year),
            editionYear: year,
            startsOn: `${year}-01-23`,
            endsOn: `${year}-01-30`,
            dateState: "confirmed",
            scheduleStatus: "scheduled",
            countryCode: "GB",
            ...place,
            termIds: [],
          },
        ],
      },
    },
    sources,
    ...(discoveries ? { discoveries } : {}),
  };
}
