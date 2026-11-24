import type { RegressionCaseDefinition } from "../../regression";
import {
  researchStatus,
  editionSlots,
  returned,
  selectedEditionDates,
} from "../../research";
import { check } from "../../checks";

export const sourceStaleLanguageOtherProgrammeCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: {
    id: "source-stale-language-other-programme",
    suite: "regression",
    origin: "synthetic",
    task: "Check source regressions stale language",
    todayUtc: "2026-10-14",
    provenance: {
      kind: "synthetic-source-regression",
      note: "Fictional sources isolate stale-language and wrong-festival ticket failures. Saved Event is explicitly Snow Meadow Student; International is a separate festival under the same brand. No live website/search fallback.",
    },
    input: {
      mode: "refresh",
      scope: "current",
      eventId: "source-stale-language-other-programme",
      actor: "catalog-research",
      initiatedBy: "eval",
      dryRun: true,
    },
    initial: {
      event: {
        id: "source-stale-language-other-programme",
        slug: "source-stale-language-other-programme",
        canonicalName: "Snow Meadow Student",
        links: [
          {
            kind: "official_site",
            url: "https://snow-meadow.example/",
            official: true,
          },
        ],
        editions: [
          {
            id: "source-stale-language-other-programme-edition",
            editionKey: "2027",
            editionYear: 2027,
            startsOn: "2027-01-23",
            endsOn: "2027-01-30",
            dateState: "confirmed",
            scheduleStatus: "scheduled",
            countryCode: "FR",
            termIds: [],
            displayName: "Student",
            locality: "Les Orres",
          },
        ],
      },
    },
    sources: [
      {
        attemptedUrl: "https://snow-meadow.example/",
        finalUrl: "https://snow-meadow.example/",
        retrievedAt: "2026-10-14T12:00:00Z",
        method: "http",
        status: "ok",
        markdownFile: "snow-home.md",
      },
      {
        attemptedUrl: "https://snow-meadow.example/en/student/booking",
        finalUrl: "https://snow-meadow.example/en/student/booking",
        retrievedAt: "2026-10-14T12:00:00Z",
        method: "http",
        status: "ok",
        markdownFile: "snow-stale.md",
      },
      {
        attemptedUrl: "https://snow-meadow.example/hu/student/booking",
        finalUrl: "https://snow-meadow.example/hu/student/booking",
        retrievedAt: "2026-10-14T12:00:00Z",
        method: "http",
        status: "ok",
        markdownFile: "snow-current.md",
        reasonCode: "javascript_required",
      },
      {
        attemptedUrl: "https://snow-meadow.example/international/prices",
        finalUrl: "https://snow-meadow.example/international/prices",
        retrievedAt: "2026-10-14T12:00:00Z",
        method: "http",
        status: "ok",
        markdownFile: "snow-other.md",
      },
    ],
  },
  evaluate(context) {
    const { report, changes } = context;
    return [
      check(
        "catalog.edition.2027.links.set.1",
        changes.edition(
          { key: "2027" },
          "links",
          (value) =>
            value?.some(
              (item) =>
                item.kind === "ticketing" &&
                item.url === "https://snow-meadow.example/hu/student/booking",
            ) === true,
        ),
        "Include the supported links for 2027",
      ),
      check(
        "catalog.edition.2027.starts_on.preserve.1",
        !changes.edition(
          { key: "2027" },
          "starts_on",
          (value) => value != null,
        ),
        "Preserve 2027 programme start",
      ),
      check(
        "catalog.edition.2027.ends_on.preserve.2",
        !changes.edition({ key: "2027" }, "ends_on", (value) => value != null),
        "Preserve 2027 programme end",
      ),
      check(
        "catalog.edition.2027.price_details.preserve.3",
        !changes.edition(
          { key: "2027" },
          "price_details",
          (value) => value != null,
        ),
        "Preserve 2027 ticket offers",
      ),
      check(
        "catalog.edition.2027.price_min_minor.preserve.4",
        !changes.edition(
          { key: "2027" },
          "price_min_minor",
          (value) => value != null,
        ),
        "Preserve 2027 base price in minor units",
      ),
      check(
        "catalog.edition.2027.starts_on.preserve.5",
        !changes.edition(
          { key: "2027" },
          "starts_on",
          (value) => value === null,
        ),
        "Do not set 2027 programme start to null",
      ),
      check(
        "catalog.edition.2027.ends_on.preserve.6",
        !changes.edition({ key: "2027" }, "ends_on", (value) => value === null),
        "Do not set 2027 programme end to null",
      ),
      check(
        "catalog.edition.2027.date_state.preserve.7",
        !changes.edition(
          { key: "2027" },
          "date_state",
          (value) => value != null,
        ),
        "Preserve 2027 date state",
      ),
      researchStatus(context, "partial"),
      ...editionSlots(context, null, "2027"),
      returned("research.2027.dates", selectedEditionDates(context, "2027"), {
        startsOn: "2027-01-23",
        endsOn: "2027-01-30",
        state: "confirmed",
      }),
      check(
        "research.unresolved",
        report.unresolved.some(
          (question) => question.message.trim().length > 0,
        ),
        "Has unresolved questions=true",
      ),
    ];
  },
};
