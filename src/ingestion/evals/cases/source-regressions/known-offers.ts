import type { RegressionCaseDefinition } from "../../regression";
import {
  researchStatus,
  editionSlots,
  editionByKey,
  returned,
} from "../../research";
import { check } from "../../checks";

export const sourceKnownOffersBlockedCheckoutCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: {
    id: "source-known-offers-blocked-checkout",
    suite: "regression",
    origin: "synthetic",
    task: "Check source regressions known offers",
    todayUtc: "2026-10-14",
    provenance: {
      kind: "synthetic-source-regression",
      note: "Fictional sources isolate observed failure patterns; not captured website content. No live website/search fallback.",
    },
    input: {
      mode: "refresh",
      scope: "current",
      eventId: "source-known-offers-blocked-checkout",
      actor: "catalog-research",
      initiatedBy: "eval",
      dryRun: true,
    },
    initial: {
      event: {
        id: "source-known-offers-blocked-checkout",
        slug: "source-known-offers-blocked-checkout",
        canonicalName: "Sound Trail",
        links: [
          {
            kind: "official_site",
            url: "https://sound-trail.example/",
            official: true,
          },
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
    sources: [
      {
        attemptedUrl: "https://sound-trail.example/",
        finalUrl: "https://sound-trail.example/",
        retrievedAt: "2026-10-14T12:00:00Z",
        method: "http",
        status: "ok",
        markdownFile: "offers.md",
      },
      {
        attemptedUrl: "https://sound-trail.example/checkout",
        finalUrl: "https://sound-trail.example/checkout",
        retrievedAt: "2026-10-14T12:00:00Z",
        method: "http",
        status: "failed",
        markdownFile: "empty.md",
        reasonCode: "http_401",
      },
      {
        attemptedUrl: "https://sound-trail.example/extras",
        finalUrl: "https://sound-trail.example/extras",
        retrievedAt: "2026-10-14T12:00:00Z",
        method: "http",
        status: "failed",
        markdownFile: "empty.md",
        reasonCode: "firecrawl_http_429",
      },
    ],
  },
  evaluate(context) {
    const { report, data, changes } = context;
    const edition = editionByKey(data, "2027");
    return [
      check(
        "catalog.edition.2027.price_details.set.1",
        changes.edition(
          { key: "2027" },
          "price_details",
          (value) =>
            value?.some(
              (item) =>
                item.label === "Three-concert pass" &&
                Object.is(item.amount, 9.99) &&
                item.currency === "GBP",
            ) === true,
        ),
        "Include the supported ticket offers for 2027",
      ),
      check(
        "catalog.edition.2027.price_details.set.2",
        changes.edition(
          { key: "2027" },
          "price_details",
          (value) =>
            value?.some(
              (item) =>
                item.label === "Stay package" &&
                item.amount === 899 &&
                item.currency === "GBP",
            ) === true,
        ),
        "Include the supported ticket offers for 2027",
      ),
      check(
        "catalog.edition.2027.price_min_minor.preserve.1",
        !changes.edition(
          { key: "2027" },
          "price_min_minor",
          (value) => value != null,
        ),
        "Preserve 2027 base price in minor units",
      ),
      check(
        "catalog.edition.2027.price_currency.preserve.2",
        !changes.edition(
          { key: "2027" },
          "price_currency",
          (value) => value != null,
        ),
        "Preserve 2027 base price currency",
      ),
      check(
        "catalog.edition.2027.price_details.preserve.3",
        !changes.edition(
          { key: "2027" },
          "price_details",
          (value) =>
            value?.some((item) => Object.is(item.amount, 615.35)) === true,
        ),
        "Exclude unsupported ticket offers for 2027",
      ),
      check(
        "catalog.edition.2027.price_details.preserve.4",
        !changes.edition(
          { key: "2027" },
          "price_details",
          (value) => value?.some((item) => item.currency === "USD") === true,
        ),
        "Exclude unsupported ticket offers for 2027",
      ),
      check(
        "catalog.edition.2027.price_details.preserve.5",
        !changes.edition(
          { key: "2027" },
          "price_details",
          (value) =>
            value?.some(
              (item) =>
                item.availability === "available" ||
                item.availability === "sold_out" ||
                item.availability === "closed",
            ) === true,
        ),
        "Exclude unsupported ticket offers for 2027",
      ),
      researchStatus(context, "partial"),
      ...editionSlots(context, null, "2027"),
      returned("research.2027.tickets", edition?.tickets, { basePrice: null }),
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
