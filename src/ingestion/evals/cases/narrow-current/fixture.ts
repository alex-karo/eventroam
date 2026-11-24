import type { RegressionPipelineCaseFile } from "../../fixtures";
import { refreshInput, sourceReplay } from "../fixture";

type NarrowEdition =
  RegressionPipelineCaseFile["initial"]["event"]["editions"][number];

const savedEdition = {
  dateState: "confirmed",
  scheduleStatus: "scheduled",
  countryCode: "PT",
  venueName: "Old Grounds",
} as const;

const openAirTerms = [
  "validation:festival",
  "validation:openair",
  "validation:music",
  "catalog:term:genre:electronic",
];

export const summer2026: NarrowEdition = {
  ...savedEdition,
  id: "narrow-2026",
  editionKey: "2026",
  editionYear: 2026,
  startsOn: "2026-06-04",
  endsOn: "2026-06-05",
  termIds: openAirTerms,
};

export const summer2027: NarrowEdition = {
  ...savedEdition,
  id: "narrow-2027",
  editionKey: "2027",
  editionYear: 2027,
  startsOn: "2027-06-04",
  endsOn: "2027-06-05",
  termIds: openAirTerms,
};

export const autumn2026: NarrowEdition = {
  ...savedEdition,
  id: "narrow-winter-2026",
  editionKey: "winter-2026",
  editionYear: 2026,
  startsOn: "2026-09-04",
  endsOn: "2026-09-05",
  termIds: [
    "validation:festival",
    "validation:mixed",
    "validation:music",
    "catalog:term:genre:metal",
  ],
};

export function narrowPage(name: string) {
  const url = `https://narrow-fixture.example/${name}`;
  return sourceReplay(url, "2026-10-14T12:00:00Z", `${name}.md`);
}

export function narrowFixture(
  name: string,
  editions: NarrowEdition[],
  note = "Synthetic official announcements isolate scope and continuity decisions; no live source fallback.",
): RegressionPipelineCaseFile {
  const id = `narrow-current-${name}`;
  const page = narrowPage(name);
  return {
    id,
    suite: "regression",
    origin: "synthetic",
    task: `Check narrow current ${name.replaceAll("-", " ")}`,
    todayUtc: "2026-10-14",
    provenance: { kind: "synthetic-current-regression", note },
    input: refreshInput(id, "current"),
    initial: {
      event: {
        id,
        slug: id,
        canonicalName: "River Festival",
        description: "Saved description",
        shortDescription: "Saved short description",
        links: [
          { kind: "official_site", url: page.attemptedUrl, official: true },
        ],
        editions,
      },
    },
    sources: [page],
  };
}
