import { applyCatalogItem } from "@/catalog/write/apply-operation";
import type { CatalogAttempt } from "./attempt";
import type { IngestionData } from "./contracts";
import { readyCatalogPlan, summarizeCatalogWrite } from "./pipeline";
import { assertRefreshBaseline } from "./research/guards";
import { assertLocationPreviousPoints } from "./roles/location/donor-guard";
import { attemptedCatalogFields, reportEventId } from "./workflow-logging";

export function writeCatalog(
  owned: CatalogAttempt,
  data: IngestionData,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const plan = readyCatalogPlan(data);
  if (!plan) {
    return;
  }
  const started = performance.now();
  const captureWrite = (
    outcome: ReturnType<typeof summarizeCatalogWrite>["outcome"] | "failed",
    kinds: ReturnType<typeof summarizeCatalogWrite>["changedKinds"] = [],
  ) =>
    owned.captureMetric?.("ingestion_catalog_write_finished", {
      outcome,
      duration_ms: Math.round(performance.now() - started),
      planned_operations: plan.operations.length,
      changed_operations: kinds.length,
      changed_operation_kinds: kinds,
    });
  if (!plan.operations.length) {
    data.outcome = "unchanged";
    captureWrite(data.outcome);
    return;
  }
  try {
    data.applied = applyCatalogItem(owned.deps.client, plan.operations, {
      dryRun: owned.input.dryRun,
      beforeApply: (client) => {
        if (owned.input.mode === "refresh") {
          assertRefreshBaseline(
            client,
            owned.input.eventId!,
            data.context!.catalog[0].editions,
          );
        }
        assertLocationPreviousPoints(
          client,
          data.editorValidation?.status === "continue"
            ? data.editorValidation.value.location.previousPoints
            : [],
        );
      },
    });
    const { outcome, changedKinds } = summarizeCatalogWrite(plan, data.applied);
    data.outcome = outcome;
    captureWrite(outcome, changedKinds);
    owned.trace?.tracing.setEventId(
      reportEventId(owned.input, plan, data.applied),
    );

    owned.trace?.log?.info("Catalog write finished", {
      stage: "write",
      dryRun: owned.input.dryRun,
      fields: attemptedCatalogFields(plan.operations),
    });
  } catch (error) {
    if (!data.applied) {
      captureWrite("failed");
    }
    if (signal.aborted) {
      throw error;
    }
    data.outcome = "failed";
    owned.trace?.failed("write_failed");
    data.errors.push({
      code: "write_failed",
      stage: "write",
      message: "Catalog write failed",
    });
  }
  return { applied: data.applied, outcome: data.outcome };
}
