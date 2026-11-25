# Design

## TL;DR

Research measures the frozen source collection. Reader measures each canonical
page after processing. Editor measures decisions and returns during review.
The catalog write step measures the transaction result from writer receipts.
One server module sends these events to PostHog with the durable ingestion run
ID. See the [proposal](proposal.md).

## Key decisions

- Use the configured PostHog host and project key with the installed Node SDK.
  Stage events can run with AI tracing off. Send events without person
  processing. Delivery is best effort and uses the SDK queue. The stages do not
  wait for a network response. Skip eval experiments.
- Count pages read successfully and completed web searches. A Research
  check has evidence coverage if it has no blocker and cites a page with bound
  evidence. This measures source coverage. Fact-level accuracy needs evals.
  Failed or cancelled Research can send partial activity. A valid summary is
  required for coverage counts.
- Use the original page body length and the union of accepted evidence spans
  and their context spans. Use UTF-16 units for both. Skip the coverage value
  if Reader did not process the page or the body is empty.
- Count initial Editor decisions for groups presented at the first review.
  Count dispatched returns from the review loop separately from repairs
  started before review by validation. Use the final review and parent
  decisions to show how each group ended. A return counts once when its
  repair record starts, including if that repair fails.
- Use writer receipts for changed operations. Filter by `dry_run=false` to
  count actual catalog changes.

## Risks and validation

Use fixed ingestion inputs and a controlled PostHog receiver in tests. Check
event content, page deduplication, span overlap, review outcomes, and catalog
state after preview, apply, and a write failure. Check that apply can finish
during a PostHog failure.
