# Proposal

## Why

Mastra Studio shows no recent runs after ingestion, although private reports exist in the catalog.
The owner needs to open past CLI and Studio runs and inspect their saved steps.

## What Changes

Save native workflow history for new preview and apply runs on the selected host.
Studio opens saved input, progress, results, and execution-to-attempt IDs after process exit, without catalog access or model credentials.
Keep history private and preserve existing content rules.
Use a separate local workflow database, retained in the container data volume.

Use Mastra input validation before `onStart` and native execution ID generation.
Remove the repeated input schema parse and the CLI `randomUUID()` call.

The owner accepted these decisions on 2026-10-27:

- **Required history.** A storage failure prevents or stops execution and gives a nonzero CLI result. Preserve confirmed commits and reports; do not replay work. Paid work can already have occurred. Optional observability stays best effort.
- **Manual cleanup.** Keep snapshots until native deletion of completed runs or a store reset with all writers stopped. The store grows until cleanup. Deletion preserves other stores but removes saved evidence for old-ID checks; new attempts need fresh IDs.
- **CLI and intermediate progress.** Save CLI and Studio executions, including progress before completion, so interrupted work remains inspectable.

Historical import, execution recovery, per-step execution, custom UI, comparison dashboards, full source capture, managed remote storage, cross-host sync, automatic cleanup, scheduled ingestion, and tracing refactoring are outside scope.

## UI limits

Studio shows the last saved state and accumulated results, not every snapshot revision or unsaved work.
A stopped run can still show `running`. A commit can succeed before its snapshot fails; durable reports and audit remain the authority for catalog writes.
Native success does not certify research, editorial, Location, catalog, or report success. Inspect their separate results where saved.
A CLI history error can coexist with confirmed writes and a completed report.

Native `/start` returns early and cannot include later storage errors. Calls that await execution receive those errors.
History has no token or cost totals; those remain in optional observability. History covers only the selected host and store.

## Capabilities

### Modified Capabilities

- `operations/ingestion-diagnostics`:
  - **Before**: Studio exposes progress and outcomes; the implementation saves no workflow snapshots.
  - **After**: Studio also opens saved CLI and Studio steps after process exit.
- `operations/release-operations`:
  - **Before**: Compose retains catalog and observability files.
  - **After**: Its data volume also retains workflow history.

## Impact

Update workflow setup, CLI and Studio hosts, container paths, offline fixtures, and owner guides.
Add the Mastra LibSQL dependency and workflow path setting. Keep catalog schema, report/model contracts, publication rules, and public APIs unchanged.
