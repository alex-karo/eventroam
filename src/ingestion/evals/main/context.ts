import { isDeepStrictEqual as same } from "node:util";
import type { readResearchCatalog } from "@/catalog/read/research";
import type { CatalogResearchResult } from "../../contracts";
import { hasHostFailure } from "../../runs";
import type { PipelineEvalCase } from "../fixtures";
import { scoreResearch } from "../research-score";
import { scoreToolUse, type EvalToolCall } from "../tool-use";
import { check, fact } from "./facts";

export type Catalog = ReturnType<typeof readResearchCatalog>;
export type Edition = Catalog[number]["editions"][number];

// Accept both until agent status rules are deterministic. See the eval guide follow-up.
export const mainScheduleStatuses = ["announced", "scheduled"] as const;

const optionalEditionFields = [
  "displayName",
  "sizeEstimate",
  "venueName",
  "venueAddress",
  "locality",
  "administrativeArea",
  "timeZone",
  "priceKind",
  "priceCurrency",
  "priceMinMinor",
  "priceMaxMinor",
  "priceCoverage",
  "priceQualification",
  "priceDetails",
  "links",
] as const satisfies readonly (keyof Edition)[];

export function savedEditions(
  original: Catalog[number] | undefined,
  event: Catalog[number] | undefined,
  allowedUpdates: Partial<Omit<Edition, "terms">> & {
    termIds?: readonly string[];
  } = {},
) {
  return fact(
    "saved.editions",
    original?.editions.every((saved) => {
      const actual = event?.editions.find((edition) => edition.id === saved.id);
      if (!actual) {
        return false;
      }
      const expected = { ...saved };
      const { termIds, ...fields } = allowedUpdates;
      for (const field of optionalEditionFields) {
        const value = saved[field];
        if (
          !Object.hasOwn(fields, field) &&
          (value == null || (Array.isArray(value) && value.length === 0))
        ) {
          Object.assign(expected, { [field]: actual[field] });
        }
      }
      if (
        saved.terms.length === 0 &&
        termIds &&
        same(
          actual.terms
            .map((term) => term.id)
            .sort((a, b) => a.localeCompare(b)),
          [...termIds].sort((a, b) => a.localeCompare(b)),
        )
      ) {
        expected.terms = actual.terms;
      }
      if (
        mainScheduleStatuses.some(
          (status) => status === saved.scheduleStatus,
        ) &&
        mainScheduleStatuses.some((status) => status === actual.scheduleStatus)
      ) {
        expected.scheduleStatus = actual.scheduleStatus;
      }
      for (const [field, value] of Object.entries(fields)) {
        if (
          (saved[field as keyof Edition] == null ||
            (field === "publicationState" &&
              saved.publicationState === "draft" &&
              value === "published") ||
            (field === "coordinatePrecision" &&
              saved.coordinatePrecision === "unknown" &&
              saved.latitude == null &&
              saved.longitude == null)) &&
          same(actual[field as keyof Edition], value)
        ) {
          Object.assign(expected, { [field]: value });
        }
      }
      return same(
        { ...actual, version: saved.version, updatedAt: saved.updatedAt },
        expected,
      );
    }),
    [true],
  );
}

export function mainContext(
  item: PipelineEvalCase,
  before: Catalog,
  after: Catalog,
  report: CatalogResearchResult,
  calls: EvalToolCall[],
) {
  const eventId = item.initial.event.id;
  const original = before.find((event) => event.id === eventId);
  const event = after.find((event) => event.id === eventId);
  const savedIds = original?.editions.map((edition) => edition.id) ?? [];
  const created =
    event?.editions.filter((edition) => !savedIds.includes(edition.id)) ?? [];
  const next = created.length === 1 ? created[0] : undefined;
  const research = scoreResearch(item, report);
  const tools = scoreToolUse(item.expectations.toolUse, calls);
  return {
    original,
    event,
    next,
    created,
    report,
    saved: savedEditions(original, event),
    conditions: [
      {
        path: "execution",
        passed: !hasHostFailure(report),
        message: "Host workflow or run persistence failed",
      },
      {
        path: "research",
        passed: research.score === 1,
        message: research.checks
          .filter((item) => !item.matched)
          .map((item) => item.description)
          .join("; "),
      },
      check("toolUse", !tools || tools.score === 1),
      check(
        "event.identity",
        !!original &&
          !!event &&
          report.eventId === eventId &&
          same(
            before.map((item) => item.id).sort((a, b) => a.localeCompare(b)),
            after.map((item) => item.id).sort((a, b) => a.localeCompare(b)),
          ),
      ),
      check(
        "protected.events",
        before
          .filter((item) => item.id !== eventId)
          .every((saved) =>
            same(
              saved,
              after.find((item) => item.id === saved.id),
            ),
          ),
      ),
    ],
  };
}
export type MainContext = ReturnType<typeof mainContext>;

export function fillConditions({ event, next, created, report }: MainContext) {
  const operation = report.operations.find(
    (op) =>
      op.kind === "createEdition" &&
      op.eventId === event?.id &&
      op.data.editionKey === next?.editionKey,
  );
  return [
    check(
      "next.identity",
      created.length === 1 &&
        !!operation?.tempKey &&
        report.references[operation.tempKey] === next?.id,
    ),
    check(
      "publication",
      event?.publicationState === "published" &&
        next?.publicationState === "published",
    ),
  ];
}

export function preservedConditions({ event, created }: MainContext) {
  return [
    check("editions.identity", created.length === 0),
    check("publication", event?.publicationState === "draft"),
  ];
}
