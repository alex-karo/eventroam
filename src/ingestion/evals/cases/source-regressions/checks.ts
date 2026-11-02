import { searchCount, readBeforeSearch } from "../../tool-use";
import type { RegressionEvaluator } from "../../regression";
import {
  researchStatus,
  editionSlots,
  editionByKey,
  returned,
  selectedEditionDates,
} from "../../research";
import { check } from "../../checks";

export const checks = {
  "source-known-offers-blocked-checkout": (context) => {
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
  "source-stale-language-other-programme": (context) => {
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
  "source-homonym-wrong-saved-website": (context) => {
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
} satisfies Record<string, RegressionEvaluator>;
