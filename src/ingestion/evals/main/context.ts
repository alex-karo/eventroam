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
    saved: fact(
      "saved.editions",
      original?.editions.every((saved) =>
        same(
          saved,
          event?.editions.find((edition) => edition.id === saved.id),
        ),
      ),
      [true],
    ),
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
      check(
        "fixtures",
        !report.sources.some(
          (source) => source.reason === "not_in_eval_fixture",
        ) &&
          !report.geocoding.observations.some(
            (item) =>
              item.result.status === "error" &&
              item.result.code === "fixture_miss",
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
