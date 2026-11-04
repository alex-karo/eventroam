import type { EvalCase, RegressionPipelineEvalCase } from "../../fixtures";
import type { RegressionEvaluator } from "../../regression";
import { check } from "../../checks";
import { researchDidNotFail } from "../../research";

export function wackenAddCase(cases: EvalCase[]): RegressionPipelineEvalCase {
  const parent = cases.find((item) => item.id === "wacken");
  if (!parent || parent.location) {
    throw new Error("Wacken add needs the Wacken pipeline fixture");
  }
  return {
    ...parent,
    id: "wacken-add",
    suite: "regression",
    task: "Add Wacken from a free text note and confirm its location from sources",
    input: {
      mode: "add",
      input: [
        "Wacken Open Air, metal festival in Germany.",
        "Website: https://www.wacken.com/",
        "Possible dates: 29 July to 1 August 2027.",
        "Map pin from my notes: 53.5511, 9.9937.",
        "These details can be wrong. Find the event and check the sources.",
      ].join("\n"),
      actor: "catalog-research",
      initiatedBy: "eval",
      dryRun: true,
    },
    initial: {
      event: {
        id: "eval-control-event",
        slug: "eval-control-event",
        canonicalName: "Control Festival",
        editions: [],
      },
    },
    provenance: {
      kind: "captured-sources-with-synthetic-add-note",
      note: "Reuse all Wacken source responses, geocoding responses and the fixed date without changes. The owner note and unrelated catalog seed are synthetic. The note has incorrect dates and a Hamburg pin. No Wacken record exists before the dry run. No live source fallback is used.",
    },
  };
}

export const checks = {
  "wacken-add": ({ item, report, calls }) => {
    const creations = report.operations.filter(
      (op) => op.kind === "createEvent",
    );
    const event = creations[0];
    const eventId = event?.tempKey
      ? report.references[event.tempKey]
      : undefined;
    const editions = report.operations.filter(
      (op) => op.kind === "createEdition",
    );
    const next = editions.filter((op) => op.data.editionYear === 2027);
    const nextId = next[0]?.tempKey
      ? report.references[next[0].tempKey]
      : undefined;
    const changed = (
      subject: string | undefined,
      field: string,
      value: unknown,
    ) =>
      !!subject &&
      report.changes.some(
        (change) =>
          change.subject === subject &&
          change.field === field &&
          Object.is(change.newValue, value),
      );
    return [
      ...researchDidNotFail(report),
      check(
        "catalog.created",
        report.mode === "add" &&
          ["created", "published"].includes(report.outcome),
      ),
      check(
        "catalog.event.identity",
        creations.length === 1 &&
          !!eventId &&
          report.eventId === eventId &&
          eventId !== item.initial.event.id,
      ),
      check(
        "catalog.event.name",
        changed(eventId, "canonical_name", "Wacken Open Air"),
      ),
      check(
        "catalog.next.identity",
        next.length === 1 &&
          !!nextId &&
          next[0].eventId === `$${event?.tempKey}`,
      ),
      ...(
        [
          ["starts_on", "2027-07-28"],
          ["ends_on", "2027-07-31"],
          ["date_state", "confirmed"],
          ["schedule_status", "scheduled"],
          ["country_code", "DE"],
          ["locality", "Wacken"],
          ["latitude", 54.02078040137254],
          ["longitude", 9.375972747802734],
          ["coordinate_precision", "locality"],
        ] as const
      ).map(([field, value]) =>
        check(
          `catalog.next.${field}`,
          changed(nextId, field, value),
          `Set ${field} to ${JSON.stringify(value)} from sources`,
        ),
      ),
      check(
        "catalog.notePinRejected",
        report.changes.every(
          (change) =>
            !(
              change.field === "latitude" && Object.is(change.newValue, 53.5511)
            ) &&
            !(
              change.field === "longitude" && Object.is(change.newValue, 9.9937)
            ),
        ),
      ),
      check(
        "catalog.controlPreserved",
        report.changes.every(
          (change) => change.subject !== item.initial.event.id,
        ),
      ),
      check(
        "sources.inspected",
        calls.some(
          (call) =>
            call.tool === "readPage" &&
            call.url.startsWith("https://www.wacken.com/"),
        ),
      ),
    ];
  },
} satisfies Record<string, RegressionEvaluator>;
