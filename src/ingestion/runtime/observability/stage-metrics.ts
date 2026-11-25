import { PostHog } from "posthog-node";
import type { CatalogOperation } from "@/catalog/operations/operation";
import type { CatalogResearchInput } from "../../contracts";
import type { Source } from "../../evidence/contracts";
import type { ProposalGroup } from "../../groups";
import type { ReviewDecision } from "../../roles/editor/contracts";

type StageMetrics = {
  ingestion_research_finished: {
    status: "completed" | "failed" | "cancelled";
    duration_ms: number;
    pages_read: number;
    pages_with_evidence: number;
    searches_completed: number;
    assigned_checks: number;
    returned_checks?: number;
    checks_with_evidence?: number;
    blocked_checks?: number;
  };
  ingestion_reader_finished: {
    source_id: string;
    processing: Source["processing"];
    duration_ms: number;
    page_utf16_units: number;
    evidence_count?: number;
    marked_utf16_units?: number;
    marked_percent?: number;
  };
  ingestion_editor_finished: {
    status: "completed" | "rejected" | "failed" | "cancelled";
    duration_ms: number;
    review_calls: number;
  };
  ingestion_editor_group_reviewed: {
    group: string;
    owner: ProposalGroup["owner"];
    target: ProposalGroup["target"];
    first_proposed: boolean;
    first_decision?: ReviewDecision["decision"];
    validation_returns: number;
    proposal_returns: number;
    omission_returns: number;
    final_result:
      "approved" | "withdrawn" | "rejected" | "dropped" | "incomplete";
  };
  ingestion_catalog_write_finished: {
    outcome: "created" | "updated" | "published" | "unchanged" | "failed";
    duration_ms: number;
    planned_operations: number;
    changed_operations: number;
    changed_operation_kinds: CatalogOperation["kind"][];
  };
};

export type CaptureStageMetric = <Event extends keyof StageMetrics>(
  event: Event,
  properties: StageMetrics[Event],
) => void;

let posthog: PostHog | undefined;

export function ingestionStageMetrics(
  runId: string,
  input: Pick<CatalogResearchInput, "mode" | "scope" | "dryRun">,
): CaptureStageMetric | undefined {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();
  if (!key || !host) {
    return;
  }

  return (event, properties) => {
    try {
      posthog ??= new PostHog(key, {
        host,
        requestTimeout: 1000,
        fetchRetryCount: 0,
        disableGeoip: true,
      });
      posthog.capture({
        distinctId: `ingestion:${runId}`,
        event,
        properties: {
          ...properties,
          run_id: runId,
          mode: input.mode,
          scope: input.scope ?? null,
          dry_run: input.dryRun ?? true,
          $process_person_profile: false,
        },
      });
    } catch {
      // A sender failure must not change the result of a stage.
    }
  };
}

export async function shutdownIngestionStageMetrics() {
  const client = posthog;
  posthog = undefined;
  try {
    await client?.shutdown(2000);
  } catch {
    // A sender failure must not prevent Studio shutdown.
  }
}
