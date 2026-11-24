import { check } from "../../checks";
import type { RegressionCaseDefinition } from "../../regression";
import { editionSlots } from "../../research";
import { refreshInput, sourceReplay } from "../fixture";
import { checkScheduledEditions } from "./checks";

const postponementUrl =
  "https://marcopolofest.hr/hr/novosti/31-marko-polo-festival-odgada-se-za-novi-termin";
const replacementUrl =
  "https://marcopolofest.hr/hr/novosti/31-marko-polo-festival-vidimo-se-27-studenoga";

export const scheduleStatusMarcoCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: {
    id: "schedule-status-marco",
    suite: "regression",
    origin: "captured",
    task: "Check schedule status for Marco Polo Fest",
    todayUtc: "2026-11-14",
    provenance: {
      kind: "captured-schedule-status-regression",
      note: "Source excerpts keep the original text from the production audit of 2026-11-14. Navigation and unrelated text are omitted. Saved catalog state and fixed Reader selections isolate schedule status. No live source fallback. Both source URLs are saved links so Research can inspect the excerpts without search.",
    },
    input: refreshInput("event:3f7d7e45b34d4cdb70d1", "current"),
    initial: {
      event: {
        id: "event:3f7d7e45b34d4cdb70d1",
        slug: "marco-polo-fest",
        canonicalName: "Marco Polo Fest",
        links: [
          {
            kind: "official_site",
            url: postponementUrl,
            official: true,
          },
          {
            kind: "other",
            url: replacementUrl,
            official: true,
          },
        ],
        editions: [
          {
            id: "edition:3f7d7e45b34d4cdb70d1",
            editionKey: "2026",
            editionYear: 2026,
            startsOn: "2026-11-27",
            endsOn: "2026-11-27",
            dateState: "confirmed",
            scheduleStatus: "postponed",
            countryCode: "HR",
            termIds: ["validation:festival", "validation:music"],
          },
        ],
      },
    },
    sources: [
      sourceReplay(
        postponementUrl,
        "2026-11-13T04:35:38.230Z",
        "marco-postponed.md",
        {
          readerOutput: {
            overview:
              "The 25 September notice postpones the 31st festival; new dates will follow.",
            coverage: {
              found: ["Festival dates and schedule status"],
              notPublished: [],
            },
            topics: ["identity", "dates", "status"],
            statedYears: ["2026"],
            limitations: [],
            evidence: [
              {
                quote: {
                  start: 1,
                  end: 5,
                },
                topics: ["identity", "dates", "status"],
              },
            ],
          },
        },
      ),
      sourceReplay(
        replacementUrl,
        "2026-11-13T04:35:38.229Z",
        "marco-replacement.md",
        {
          readerOutput: {
            overview:
              "The 12 October notice announces 27 November for the same 31st festival.",
            coverage: {
              found: ["Festival dates and schedule status"],
              notPublished: [],
            },
            topics: ["identity", "dates", "status"],
            statedYears: ["2026"],
            limitations: [],
            evidence: [
              {
                quote: {
                  start: 1,
                  end: 10,
                },
                topics: ["identity", "dates", "status"],
              },
            ],
          },
        },
      ),
    ],
  },
  evaluate: (context) => [
    check(
      "sources.replacementAnnouncement",
      context.report.sources.some(
        (source) =>
          source.attemptedUrl === replacementUrl && source.outcome === "ok",
      ),
      "Inspect the supplied replacement announcement URL",
    ),
    ...editionSlots(context, null, "2026"),
    ...checkScheduledEditions(context, ["2026"]),
  ],
};
