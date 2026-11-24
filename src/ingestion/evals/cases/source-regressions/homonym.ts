import { searchCount, readBeforeSearch } from "../../tool-use";
import type { RegressionCaseDefinition } from "../../regression";
import {
  researchStatus,
  editionSlots,
  editionByKey,
  returned,
} from "../../research";
import { check } from "../../checks";

export const sourceHomonymWrongSavedWebsiteCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: {
    id: "source-homonym-wrong-saved-website",
    suite: "regression",
    origin: "synthetic",
    task: "Check source regressions homonym",
    todayUtc: "2026-10-14",
    provenance: {
      kind: "synthetic-source-regression",
      note: "Fictional sources isolate observed failure patterns; not captured website content. No live website/search fallback. The source states that no previous Edition exists, so full-scope selection can complete without changing the source-policy assertions.",
    },
    input: {
      mode: "refresh",
      scope: "full",
      eventId: "source-homonym-wrong-saved-website",
      actor: "catalog-research",
      initiatedBy: "eval",
      dryRun: true,
    },
    initial: {
      event: {
        id: "source-homonym-wrong-saved-website",
        slug: "source-homonym-wrong-saved-website",
        canonicalName: "Harbor Echo",
        links: [
          {
            kind: "official_site",
            url: "https://harbor-echo-australia.example/",
            official: true,
          },
        ],
        editions: [
          {
            id: "source-homonym-wrong-saved-website-edition",
            editionKey: "2027",
            editionYear: 2027,
            startsOn: "2027-01-23",
            endsOn: "2027-01-30",
            dateState: "confirmed",
            scheduleStatus: "scheduled",
            countryCode: "GB",
            termIds: [],
            locality: "Castlewellan",
            venueName: "Castlewellan Grounds",
          },
        ],
      },
    },
    sources: [
      {
        attemptedUrl: "https://harbor-echo-australia.example/",
        finalUrl: "https://harbor-echo-australia.example/",
        retrievedAt: "2026-10-14T12:00:00Z",
        method: "http",
        status: "ok",
        markdownFile: "homonym.md",
      },
      {
        attemptedUrl: "https://harbor-echo-uk.example/",
        finalUrl: "https://harbor-echo-uk.example/",
        retrievedAt: "2026-10-14T12:00:00Z",
        method: "http",
        status: "ok",
        markdownFile: "identity.md",
      },
    ],
  },
  evaluate(context) {
    const { data, changes } = context;
    const edition = editionByKey(data, "2027");
    return [
      check(
        "catalog.edition.2027.price_kind.set.1",
        changes.edition(
          { key: "2027" },
          "price_kind",
          (value) => value === "free",
        ),
        'Set 2027 price type to "free"',
      ),
      check(
        "catalog.event.links.set.2",
        changes.event(
          "links",
          (value) =>
            value?.some(
              (item) =>
                item.kind === "official_site" &&
                item.url === "https://harbor-echo-uk.example/",
            ) === true,
        ),
        "Include the supported links for Event",
      ),
      check(
        "catalog.edition.2027.country_code.preserve.1",
        !changes.edition(
          { key: "2027" },
          "country_code",
          (value) => value !== "GB",
        ),
        "Preserve 2027 country",
      ),
      check(
        "catalog.edition.2027.starts_on.preserve.2",
        !changes.edition(
          { key: "2027" },
          "starts_on",
          (value) => value != null,
        ),
        "Preserve 2027 programme start",
      ),
      check(
        "catalog.edition.2027.ends_on.preserve.3",
        !changes.edition({ key: "2027" }, "ends_on", (value) => value != null),
        "Preserve 2027 programme end",
      ),
      check(
        "catalog.edition.2027.locality.preserve.4",
        !changes.edition(
          { key: "2027" },
          "locality",
          (value) => value === "Byron Bay",
        ),
        'Do not set 2027 locality to "Byron Bay"',
      ),
      check(
        "catalog.event.links.preserve.5",
        !changes.event(
          "links",
          (value) =>
            value?.some(
              (item) =>
                item.kind === "official_site" &&
                item.url === "https://harbor-echo-australia.example/",
            ) === true,
        ),
        "Exclude unsupported links for Event",
      ),
      check(
        "catalog.edition.2027.starts_on.preserve.6",
        !changes.edition(
          { key: "2027" },
          "starts_on",
          (value) => value === null,
        ),
        "Do not set 2027 programme start to null",
      ),
      check(
        "catalog.edition.2027.ends_on.preserve.7",
        !changes.edition({ key: "2027" }, "ends_on", (value) => value === null),
        "Do not set 2027 programme end to null",
      ),
      researchStatus(context, "success"),
      ...editionSlots(context, null, "2027"),
      returned("research.2027.tickets", edition?.tickets, {
        basePrice: { kind: "free" },
      }),
      check(
        "toolUse.maxSearches",
        searchCount(context.calls) <= 0,
        "searches <= 0",
      ),
      readBeforeSearch(context.calls, "https://harbor-echo-uk.example/", 1),
    ];
  },
};
