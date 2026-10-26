# Proposal

## Why

Ingestion needs to refine festival coordinates without adding geocoding work to the low-cost research model or making the editor assess map results. One Location agent will own the venue, address, locality, country, and coordinates together, so a new venue cannot accidentally retain a disproved old address or point.

## What Changes

- Use the agreed sequence: `Research → Editor → initial geocoding → Location → validated catalog write`.
- Keep research responsible for source collection, festival identity, Edition selection, and findings. Keep its existing page and search tools. Do not add geocoding to research.
- **BREAKING**: Remove location field actions from the editor. It keeps the identity decision, Edition eligibility, and all other field actions. It can read location evidence to reject a wrong festival.
- Prepare reverse geocoding for old points and forward geocoding for new location text before Location. Share identical requests within an Event. Give Location the results, all relevant location context, and available editor decisions and reasons. Editor rejection still controls which targets can proceed.
- Add one Location agent assignment per Event for the Edition slots that the editor accepts. It owns the complete location block during ingestion. It has only a bounded forward `geocode` tool for further queries when initial results are unsuitable or other spellings can help.
- Prefer saved coordinates while they remain applicable. Distinguish keeping a target point from copying a historical point. Account for moves, earlier catalog errors, coarse city results, and several venues. Permit an applicable city point when no better point is available, with locality precision and the venue question left unresolved. Reverse results provide context and do not prove an old point wrong.
- Combine the two agents' disjoint actions in code. Validate once before the existing atomic writer. No agent writes to the database.
- **BREAKING**: Add Location output, execution status, model settings, candidate references, and optional trace correlation to report version 7. Remove application-owned token and cost accounting from reports and run-history statistics. Use Mastra Observability for available token and cost metrics.
- Allow tracing for preview and evaluation runs when enabled. Keep observability optional and separate from catalog writes.
- **BREAKING**: Keep one ingestion report inside each ingestion workflow evaluation task output. Use the existing experiment result fields for execution errors and scorer results. Remove copied report fields and fabricated failure reports from evaluation artifacts.
- Evaluate missing-point completion, correction of known errors, and preservation of correct old points as separate groups. A result that always keeps old values cannot satisfy the completion and correction cases.

## Capabilities

### New Capabilities

- `catalog/location-resolution`: Source-backed decisions for the complete Edition location block, coordinate choice, inheritance, and bounded geocoding.

### Modified Capabilities

- `catalog/ingestion-updates`:
  - **Before**: The editor authorizes every field change from a matching research finding.
  - **After**: The editor owns non-location changes. Location authorizes location changes from supplied evidence and registered points.
- `catalog/refresh-scope`:
  - **Before**: Research and editing enforce two Edition roles, country bounds, and one reference date.
  - **After**: Location follows the same bounds and date, without selecting or restoring declined Editions.
- `catalog/source-access`:
  - **Before**: Source, discovery, and model work share a bounded run budget.
  - **After**: Initial forward and reverse requests and Location follow-up calls share that budget and cancellation, with one geocoding call limit and no automatic HTTP retries. Reports retain limit diagnostics; optional observability owns usage metrics.
- `catalog/ingestion-workflow`:
  - **Before**: Recovery and cancellation retain known usage as part of the run contract.
  - **After**: They retain completed work and failure details; available usage stays in optional observability.
- `catalog/ingestion-runs`:
  - **Before**: Version 6 reports retain research and editorial output and accounting.
  - **After**: Version 7 retains Location decisions, execution status, point references, and optional trace correlation. Token and cost metrics live in observability, without report or run-history copies.
- `operations/ingestion-diagnostics`:
  - **Before**: Studio and diagnostics expose the existing stages.
  - **After**: They also expose Location and initial and follow-up geocoding. Enabled tracing covers apply, preview, and evaluation runs. Evaluations retain separate completion, correction, and preservation results. Workflow evaluation artifacts retain one report per task output and separate execution errors from scores, with the same content and credential exclusions.
- `operations/storage-integrity`:
  - **Before**: Run finalization validates duplicated token, cost, and completeness statistics.
  - **After**: It validates the remaining duration, report, and lifecycle fields without requiring removed accounting data.

## Impact

The change affects `src/ingestion/`, local CLI and Studio reports, configuration, evaluation fixtures, ingestion documentation, and private run-history storage. A migration removes obsolete accounting columns from `ingestion_runs`. It uses the existing catalog operations, audit, version checks, country rules, and publication rules. It does not change public catalog fields or require a catalog schema migration.

Out of scope: a standalone Location command, human review, agent-to-agent messages, another web research agent, parallel previous/next runs, new geocoding providers, hosted processing, and replay of past diagnostic reports as database corrections. Model quality and cost will be measured separately for Location; the proposal does not promise an accuracy level or a cheaper total run.
