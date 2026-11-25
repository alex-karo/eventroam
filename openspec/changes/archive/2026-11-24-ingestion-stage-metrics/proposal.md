# Ingestion stage metrics

## Why

Operators need to measure how ingestion finds evidence, reviews proposals, and
changes the catalog. Stage events let operators keep this data if the run report
becomes smaller.

## What Changes

- Add PostHog events for Research, Reader, Editor, and catalog writes.
- Link the events in PostHog with the ingestion run ID.

## Requirements

- PostHog shows source activity and check coverage for Research.
- PostHog shows evidence count and marked page area for each page that reaches Reader.
- PostHog shows first Editor decisions, group returns, and review results.
- PostHog distinguishes committed catalog changes, previews, no changes, and write failures.
- Ingestion continues during a PostHog failure. Stage events contain metric values and technical IDs.

## Acceptance criteria

- A run with several pages sends one Research event and one Reader event per canonical page that reaches Reader. Overlapping evidence ranges count once.
- A run with a returned group shows the first decision, the return, and the final result for that group.
- The same write plan in preview and apply records separate results. Only the apply run contributes to the count of actual catalog changes.
- PostHog events contain no source or model text. The run report and prompts keep their current content and behavior.

## Impact

Operators can query the stage events in the existing PostHog project.
