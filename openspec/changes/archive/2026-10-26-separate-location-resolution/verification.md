# Verification: separate-location-resolution

Date: 2026-10-26

## Summary

| Dimension | Result |
| --- | --- |
| Completeness | 36 of 36 tasks complete; all 43 added or modified requirements have implementation evidence; one removed requirement is absent from runtime contracts. |
| Correctness | Reviewed 145 scenarios against code, prompts, fixtures, and tests. One evaluation coverage warning remains below. |
| Coherence | The implementation follows the serial three-agent design, field ownership, shared budget, and single atomic writer. Main specs match all eight delta specs. |

No checks were skipped. No critical issue was found. The change is ready for archive with one coverage warning.

## Implementation and test evidence

| Capability | Implementation | Tests |
| --- | --- | --- |
| catalog/location-resolution | `src/ingestion/location/`, `src/ingestion/tools/geocode/` | Location, geometry, Geoapify, and isolated evaluation tests cover accepted slots, initial requests, references, precision, inheritance, missing points, rejection, cancellation, and bounded failures. |
| catalog/ingestion-updates | `src/ingestion/editor/contracts.ts`, `src/ingestion/editor/prepare.ts`, `src/ingestion/location/validate.ts` | Editor and workflow tests cover disjoint ownership, matching findings, slot binding, complete location actions, and atomic failure. |
| catalog/refresh-scope | `src/ingestion/location/input.ts`, `src/ingestion/workflow.ts`, existing Research and country guards | Editor, workflow, and scope evaluation tests cover fixed dates, current scope, country conflicts, and preserved historical context. |
| catalog/source-access | `src/ingestion/runtime/budget.ts`, `src/ingestion/location/initial.ts`, `src/ingestion/tools/geocode/tool.ts` | Location and Geoapify tests cover deduplication, six shared calls, cache hits, no retries, and cancellation. |
| catalog/ingestion-workflow | `src/ingestion/workflow.ts`, `src/ingestion/attempt.ts` | Workflow and Studio transport tests cover recovery, separate runs, preview, cancellation, and failed finalization. |
| catalog/ingestion-runs | `src/ingestion/report.ts`, `src/ingestion/runs.ts`, report schemas and command consumers | Run, workflow, CLI, and evaluation tests cover report version 7, separate stage results, rejected status and reason, safe errors, and removed accounting. |
| operations/ingestion-diagnostics | `src/ingestion/runtime/observability/`, `src/ingestion/runtime/tracing/`, `src/ingestion/evals/` | Observability, transport, and evaluation tests cover stage correlation, prompt versions, content limits, unavailable metrics, native result envelopes, fixture misses, and failure exit status. |
| operations/storage-integrity | `src/db/migrations/0002_remove_run_accounting.sql`, `src/ingestion/runs.ts` | Run tests cover preserved historical rows and report JSON, removed columns, lifecycle guards, and validation without spending data. |

The removed report accounting requirement has no remaining runtime implementation. Matches in old migration files and migration tests preserve or verify historical storage only. Native observability metrics remain in scope.

## Warning

### W1: No captured case rejects an outdated official venue point

The scenario "Official coordinates refer to an outdated venue" is stated in the delta spec and handled by the Location prompt. The captured `official-venue-point.json` case tests the positive preference, but no captured case supplies an official point with explicit evidence that it belongs to a withdrawn venue. Structural point validation cannot test that factual decision.

Recommendation: add a correction case under `src/ingestion/evals/cases/location/` with that contrary evidence and assertions that reject the outdated point. This is a model evaluation coverage gap, with no observed runtime defect.

## Checks

- `npm test -- --reporter=dot`: 728 tests passed in 55 files.
- `npm run type-check`: passed.
- `npm run lint`: passed.
- `npm run deps:check`: passed.
- `npm run format:check`: passed.
- `npm run docs:check`: passed.
- `npm run openspec:validate`: passed.

The review corrected the report status list in the design to include the implemented `rejected` status.
