import type { ProposalGroup, ReturnRequest } from "../../groups";
import type { PreparedProposals } from "../../proposals";
import type { ProposalRepairs } from "../../repairs";
import type { CaptureStageMetric } from "../../runtime/observability/stage-metrics";
import type { ReviewDecision, ReviewDecisions } from "./contracts";
import { groupProposal, rejectedItem, rejectedEdition } from "./review";

type GroupReview = {
  group: ProposalGroup;
  proposed: boolean;
  first?: ReviewDecision["decision"];
  validationReturns: number;
  proposalReturns: number;
  omissionReturns: number;
};

export function editorMetrics(
  capture: CaptureStageMetric,
  groups: readonly ProposalGroup[],
  prepared: PreparedProposals,
  review: ReviewDecisions,
  repairs: ProposalRepairs,
) {
  const started = performance.now();
  const beforeReview = repairs.returnCounts;
  const observations = new Map<string, GroupReview>(
    groups.map((group) => [
      group.path,
      {
        group,
        proposed:
          review.get(group.path)?.decision !== "reject" &&
          groupProposal(prepared, group) !== undefined,
        validationReturns: beforeReview.get(group.path) ?? 0,
        proposalReturns: 0,
        omissionReturns: 0,
      },
    ]),
  );
  let reviewCalls = 0;

  return {
    reviewCalled() {
      reviewCalls += 1;
    },
    firstReview(decisions: ReviewDecision[] = []) {
      for (const { path, decision } of decisions) {
        const observation = observations.get(path);
        if (observation) {
          observation.first = decision;
        }
      }
    },
    trackReturns(proposals: PreparedProposals) {
      return (requests: ReturnRequest[]) => {
        for (const { group } of requests) {
          const observation = observations.get(group.path)!;
          if (groupProposal(proposals, group) === undefined) {
            observation.omissionReturns += 1;
          } else {
            observation.proposalReturns += 1;
          }
        }
      };
    },
    finish(
      result: "continue" | "reject" | "skip" | undefined,
      cancelled: boolean,
    ) {
      const unfinished = cancelled ? "cancelled" : "failed";
      const reviewed = result === "continue" ? "completed" : "rejected";
      capture("ingestion_editor_finished", {
        status: result ? reviewed : unfinished,
        duration_ms: Math.round(performance.now() - started),
        review_calls: reviewCalls,
      });
      const lastRepair = new Map(
        repairs.records.map((entry) => [entry.path, entry]),
      );
      for (const observation of observations.values()) {
        const {
          group: { path, owner, target },
          proposed,
          first,
          validationReturns,
          proposalReturns,
          omissionReturns,
        } = observation;
        const returns = validationReturns + proposalReturns + omissionReturns;
        if (!proposed && !first && returns === 0) {
          continue;
        }
        const last = lastRepair.get(path);
        capture("ingestion_editor_group_reviewed", {
          group: path,
          owner,
          target,
          first_proposed: proposed,
          ...(first && { first_decision: first }),
          validation_returns: validationReturns,
          proposal_returns: proposalReturns,
          omission_returns: omissionReturns,
          final_result: result
            ? groupResult(
                observation.group,
                review,
                Boolean(last?.omissionReason && !last.failure),
              )
            : "incomplete",
        });
      }
    },
  };
}

function groupResult(
  { path, target }: ProposalGroup,
  review: ReviewDecisions,
  withdrawn: boolean,
) {
  const decision = review.get(path)?.decision;
  if (decision === "reject") {
    return "rejected";
  }
  if (
    rejectedItem(review) ||
    (target !== "event" && rejectedEdition(review, target))
  ) {
    return "dropped";
  }
  if (decision === "approve") {
    return withdrawn ? "withdrawn" : "approved";
  }
  return "incomplete";
}
