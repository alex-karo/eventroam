/** Use guarded JSON expressions so an invalid report remains inspectable. */
export const INSPECT_RUN_SQL = `SELECT id AS ingestionRunId, event_id, mode, status, started_at, finished_at,
  report_json IS NOT NULL AS reportPresent,
  json_valid(report_json) AS reportValid,
  CASE WHEN json_valid(report_json) THEN json_extract(report_json, '$.schemaVersion') END AS schemaVersion,
  CASE WHEN json_valid(input_json) THEN json_extract(input_json, '$.dryRun') END AS dryRun,
  CASE WHEN json_valid(report_json) THEN
    CASE WHEN json_extract(report_json, '$.schemaVersion') = 7 THEN json_extract(report_json, '$.outcome') END
  END AS outcome,
  CASE WHEN json_valid(report_json) THEN
    CASE WHEN json_extract(report_json, '$.schemaVersion') = 7 THEN json_extract(report_json, '$.researchStatus') END
  END AS researchStatus
FROM ingestion_runs WHERE id = ?`;

export const RUN_EVIDENCE_SQL = `SELECT evidence.key AS itemIndex, evidence.value AS evidence
FROM ingestion_runs AS run,
  json_each(CASE WHEN json_valid(run.report_json) THEN
    CASE WHEN json_extract(run.report_json, '$.schemaVersion') = 7 THEN run.report_json ELSE '{}' END
    ELSE '{}' END, '$.changes') AS evidence
WHERE run.id = ? ORDER BY evidence.key LIMIT 20`;

export const CATALOG_GUIDE = `Catalog schema (SQLite names):
- events: id, slug, canonical_name, aliases (JSON array), summary, home_scope, publication_state, version, created_at, updated_at.
- editions: id, event_id -> events.id, edition_key, display_name, edition_year, starts_on, ends_on, date_state, schedule_status, publication_state, size_estimate, version.
  Location: venue_name, venue_address, locality, administrative_area, country_code, latitude, longitude, coordinate_precision, time_zone.
  Prices: price_kind, price_currency, price_min_minor, price_max_minor, price_coverage, price_qualification, price_details (JSON).
- taxonomy_terms: id, facet, slug, name, parent_id; edition_terms: edition_id, term_id.
- external_links: id, event_id OR edition_id, kind, url, label, official, created_at, updated_at.
- url_aliases: scope, path, event_id, edition_id, created_at.
- catalog_changes: id, event_id, edition_id, subject_version, changed_fields (JSON), operation_key, actor, initiated_by, changed_at, note.
- operation_receipts: operation_key, payload_hash, result (JSON), applied_at.
- ingestion_runs (private attempts): id, event_id, mode (add/refresh), status (running/completed/failed), started_at, finished_at, input_json, report_json, duration_ms.
An Event identifies a recurring gathering. An Edition identifies one occurrence. Refresh takes Event IDs, never Edition IDs. Dates are calendar dates YYYY-MM-DD, not UTC timestamps. Publication states: draft, published, withdrawn. Unknown dates are not proof of cancellation. SQL metadata can describe other columns.
Reports: ingestion_runs.id is ingestionRunId, NOT engineRunId. input_json.dryRun is preview when true and apply when false; report_json has no dryRun. Report schemaVersion 7 includes outcome, researchStatus, changes[{subject,field,oldValue,newValue,explanations}], sources[{attemptedUrl,finalUrl,retrievedAt,outcome,reason?}], errors, unresolved, sourceSummaries, operations, receipts, and raw model/editor responses.
First inspect a run with this one query and its bound ID:
${INSPECT_RUN_SQL}
No row means unknown only if output is not truncated. A null report means no saved final report. Invalid JSON or a version other than 7 limits analysis: do not interpret its fields as version 7.
Then select the relevant evidence. Edit '$.changes' to '$.sources', '$.errors', or '$.unresolved', and narrow fields or ranges as needed:
${RUN_EVIDENCE_SQL}
Prefer selected structured fields. Full reports and raw responses remain readable. SQL returns at most 200 rows and 64 KiB, and accepts at most 16 KiB SQL. State truncation and selected subsets; use narrower queries for more evidence. Output limits do not bound execution time. Costly queries block Studio, with no hard timeout or active-query cancellation. Use bound scalar parameters and omit final semicolons.`;
