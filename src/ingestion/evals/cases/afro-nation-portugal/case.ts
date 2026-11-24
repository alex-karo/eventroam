import { check } from "../../checks";
import type { RegressionCaseDefinition } from "../../regression";
import { refusedResearch, unavailableSources } from "../../research";
import { refreshInput, sourceReplay } from "../fixture";

export const afroNationPortugalBlockedCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: {
    id: "afro-nation-portugal-blocked",
    suite: "regression",
    origin: "captured",
    task: "verify",
    todayUtc: "2026-10-08",
    provenance: {
      kind: "captured-http-metadata-synthetic-replay",
      note: "Initial catalog facts came from baseline.sqlite in the same capture directory. Five URL, retrieval-time, blocked-outcome and http_403 fields came from the live dry run. Empty Markdown and fixed discovery with no candidates are synthetic deterministic replay; no website or search fallback is used. The live model returned partial with empty data, which this regression expects to reject.",
    },
    input: refreshInput("event:050e6a1b4385550023d3"),
    initial: {
      event: {
        id: "event:050e6a1b4385550023d3",
        slug: "afro-nation-portugal-050e6a1b",
        canonicalName: "Afro Nation Portugal",
        publicationState: "draft",
        links: [
          {
            kind: "other",
            url: "https://www.afronation.com/book-tickets-2027",
            label: "Website (unverified)",
            official: false,
          },
        ],
        editions: [
          {
            id: "edition:050e6a1b4385550023d3",
            editionKey: "source-row",
            editionYear: 2027,
            startsOn: "2027-06-09",
            endsOn: "2027-06-11",
            dateState: "confirmed",
            scheduleStatus: "scheduled",
            countryCode: "PT",
            publicationState: "draft",
          },
        ],
      },
    },
    sources: [
      sourceReplay(
        "https://www.afronation.com/book-tickets-2027",
        "2026-10-08T11:32:56.734Z",
        "blocked.md",
        { status: "failed", reasonCode: "http_403" },
      ),
      sourceReplay(
        "https://www.afronation.com/",
        "2026-10-08T11:33:08.365Z",
        "blocked.md",
        { status: "failed", reasonCode: "http_403" },
      ),
      sourceReplay(
        "https://www.afronation.com/ANP2027",
        "2026-10-08T11:33:08.364Z",
        "blocked.md",
        { status: "failed", reasonCode: "http_403" },
      ),
      sourceReplay(
        "https://www.afronation.com/terms_and_conditions",
        "2026-10-08T11:33:24.708Z",
        "blocked.md",
        { status: "failed", reasonCode: "http_403" },
      ),
      sourceReplay(
        "https://www.afronation.com/faqs",
        "2026-10-08T11:33:24.708Z",
        "blocked.md",
        { status: "failed", reasonCode: "http_403" },
      ),
    ],
  },
  evaluate: ({ item, report }) => [
    check(
      "event.identity",
      report.eventId === item.initial.event.id,
      "Expected the saved Afro Nation Portugal Event",
    ),
    ...refusedResearch(report),
    ...unavailableSources(report),
    check(
      "task.unresolved",
      report.unresolved.some((item) => item.message.trim().length > 0),
      "Expected an unresolved question",
    ),
  ],
};
