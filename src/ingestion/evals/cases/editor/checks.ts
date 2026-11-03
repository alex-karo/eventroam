import { officialWebsite, confirmedDates, preserveDates } from "../../changes";
import type { RegressionEvaluator } from "../../regression";
import {
  researchStatus,
  researchDidNotFail,
  editionSlots,
  editionByKey,
  returned,
  refusedResearch,
  unavailableSources,
} from "../../research";
import { check } from "../../checks";

export const checks = {
  "editor-uncited-qualification": ({ report, changes }) => [
    ...researchDidNotFail(report),
    check(
      "editor.status",
      report.editorStatus === "success",
      "Complete the fixed proposal review",
    ),
    check(
      "catalog.edition.2027.rejectRestrictedPass",
      !changes.edition(
        { key: "2027" },
        "price_details",
        (value) =>
          value?.some((offer) => offer.label === "Three-concert pass") === true,
      ),
      "Reject the ticket block qualified by the uncited eligibility notice",
    ),
  ],
  "editor-wrong-year": (context) => {
    const { report, changes } = context;
    return [
      officialWebsite(changes, [
        "https://www.wacken.com/de/",
        "https://www.wacken.com/en/",
        "https://www.wacken.com/",
      ]),
      ...confirmedDates(changes, { year: 2027 }, "2027-07-28", "2027-07-31"),
      check(
        "catalog.edition.2027.country_code.preserve.1",
        !changes.edition(
          { year: 2027 },
          "country_code",
          (value) => value !== "DE" && value != null,
        ),
        'Keep 2027 country equal to "DE" when supplied',
      ),
      ...preserveDates(changes, "source-row"),
      ...researchDidNotFail(report),
    ];
  },
  "editor-day-ticket": (context) => {
    const { report, changes } = context;
    return [
      officialWebsite(changes, ["https://www.roskilde-festival.dk/"]),
      ...confirmedDates(changes, { year: 2027 }, "2027-06-26", "2027-07-03"),
      check(
        "catalog.edition.2027.price_min_minor.set.5",
        changes.edition(
          { year: 2027 },
          "price_min_minor",
          (value) => value === 265000,
        ),
        "Set 2027 base price in minor units to 265000",
      ),
      ...preserveDates(changes, "source-row"),
      check(
        "catalog.edition.2027.venue_address.preserve.3",
        !changes.edition(
          { year: 2027 },
          "venue_address",
          (value) =>
            typeof value === "string" &&
            value
              .toLowerCase()
              .replace(/\s+/g, " ")
              .includes("rabalderstræde") &&
            value != null,
        ),
        "Exclude unsupported venue address for 2027",
      ),
      check(
        "catalog.edition.2027.country_code.preserve.4",
        !changes.edition(
          { year: 2027 },
          "country_code",
          (value) => value !== "DK" && value != null,
        ),
        'Keep 2027 country equal to "DK" when supplied',
      ),
      check(
        "catalog.edition.2027.price_min_minor.preserve.5",
        !changes.edition(
          { year: 2027 },
          "price_min_minor",
          (value) => value === 153000,
        ),
        "Do not set 2027 base price in minor units to 153000",
      ),
      ...researchDidNotFail(report),
    ];
  },
  "editor-clear": (context) => {
    const { report, changes } = context;
    return [
      check(
        "catalog.edition.source-row.venue_address.set.1",
        changes.edition(
          { key: "source-row" },
          "venue_address",
          (value) => value === null,
        ),
        "Set source-row venue address by clearing it",
      ),
      check(
        "catalog.edition.source-row.country_code.preserve.1",
        !changes.edition(
          { key: "source-row" },
          "country_code",
          (value) => value !== "DK" && value != null,
        ),
        'Keep source-row country equal to "DK" when supplied',
      ),
      ...researchDidNotFail(report),
    ];
  },
  "editor-valid-update": (context) => {
    const { report, changes } = context;
    return [
      officialWebsite(changes, [
        "https://szigetfestival.com/en/",
        "https://www.szigetfestival.com/",
        "https://szigetfestival.com/",
      ]),
      ...confirmedDates(changes, { year: 2027 }, "2027-08-10", "2027-08-14"),
      ...preserveDates(changes, "source-row"),
      ...researchDidNotFail(report),
    ];
  },
  "editor-unavailable": (context) => {
    const { report } = context;
    return [...refusedResearch(report), ...unavailableSources(report)];
  },
  "editor-recovered-website": (context) => {
    const { changes, report } = context;
    return [
      officialWebsite(changes, ["https://harborechofestival.co.uk/"]),
      ...researchDidNotFail(report),
      check(
        "editor.status",
        report.editorStatus === "success",
        "Complete the Editor review of the recovered website",
      ),
      ...editionSlots(context, null, "2027"),
    ];
  },
  "editor-unknown-currency": (context) => {
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
        "catalog.edition.2027.price_details.set.3",
        changes.edition(
          { key: "2027" },
          "price_details",
          (value) =>
            value?.some((item) => item.label === "All-programme pass") === true,
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
} satisfies Record<string, RegressionEvaluator>;
