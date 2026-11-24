import type { RegressionCaseDefinition } from "../../regression";
import {
  researchStatus,
  editionSlots,
  editionByKey,
  returned,
} from "../../research";
import { check } from "../../checks";
import { fixedHandoff, setField } from "./fixture";
import { sourceReplay } from "../fixture";
import {
  soundTrailFixture,
  soundTrailSource,
  soundTrailReaderPage,
  soundTrailGeneral,
  soundTrailClassification,
  soundTrailHomePage,
} from "./sound-trail";

export const editorUnknownCurrencyCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: {
    id: "editor-unknown-currency",
    ...soundTrailFixture,
    task: "Check editor unknown currency",
    provenance: {
      kind: "captured-research-editor-regression",
      note: "Exact research handoff from the unknown-currency editor failure; original fictional source fixtures retained. Editor input now uses fixed source-backed Reader passages and explicit proposal citations. Research and Reader do not call a model.",
    },
    sources: [
      soundTrailSource,
      sourceReplay(
        "https://sound-trail.example/checkout",
        "2026-10-14T12:00:00Z",
        "../source-regressions/empty.md",
        { status: "failed", reasonCode: "http_401" },
      ),
      sourceReplay(
        "https://sound-trail.example/extras",
        "2026-10-14T12:00:00Z",
        "../source-regressions/empty.md",
        { status: "failed", reasonCode: "firecrawl_http_429" },
      ),
    ],
    roleHandoff: fixedHandoff(
      "Normalized source-known-offers-blocked-checkout research from narrow-current-verify-2026-10-15T11-47-11-170Z.json. The ticket terms retain the amount with unknown currency. The Edition ticket link uses the inspected overview. Fixed Reader passages are copied from source-backed artifacts from the standard-tier 2026-11-02 run. Captures: fc2d9fed-1ac5-4337-87fc-691723a3b0fc:s1. Collection reads only the fixed pages. Captured proposals have explicit citations and retain their unchecked findings. Editor and eligible Location run live. Empty page-coverage lists isolate Editor review from Research navigation.",
      [
        soundTrailReaderPage,
        { url: "https://sound-trail.example/checkout", sourceId: "s2" },
        { url: "https://sound-trail.example/extras", sourceId: "s3" },
      ],
      {
        general: soundTrailGeneral([
          {
            message:
              "What additional ticket categories and offers are listed on the linked checkout and extras pages, and what are their availability states? Those relevant official pages could not be inspected.",
            editionKey: "2027",
            field: "tickets",
          },
        ]),
        tickets: {
          currentOrNextEdition: {
            tickets: setField(
              {
                variants: [
                  {
                    label: "Three-concert pass",
                    amount: 9.99,
                    currency: "GBP",
                    terms:
                      "Access to three paid concerts of the holder’s choice; does not cover the full programme. Other activities are free.",
                    availability: "unknown",
                  },
                  {
                    label: "Stay package",
                    amount: 899,
                    currency: "GBP",
                    terms:
                      "Includes lodging and the Three-concert pass only; does not include full-programme admission.",
                    availability: "unknown",
                  },
                  {
                    label: "All-programme pass",
                    terms:
                      "The page gives a price of $615.35 but provides no country or currency code; the currency cannot be established.",
                    availability: "unknown",
                  },
                ],
                basePrice: null,
              },
              "The official page publishes these three offers and prices for the first two. The all-programme pass is a full-programme offer, but its currency is unspecified, so no reliable base price can be reported. The page says availability is not stated; checkout and extras are linked for remaining categories and offers, but could not be inspected.",
              ["s1-e2", "s1-e3", "s1-e4", "s1-e5"],
            ),
          },
          checks: [],
          unresolved: [],
        },
        classification: soundTrailClassification,
        links: {
          event: { socials: {} },
          currentOrNextEdition: {
            tickets: setField(
              soundTrailHomePage,
              "The official overview lists the published offers for the 2027 Edition.",
              ["s1-e1", "s1-e2", "s1-e3"],
            ),
          },
          omitted: [],
          checks: [],
          unresolved: [],
        },
      },
    ),
  },
  evaluate: (context) => {
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
};
