SELECT id AS ingestionRunId, event_id, mode, status, started_at, finished_at,
  report_json IS NOT NULL AS reportPresent,
  json_valid(report_json) AS reportValid,
  json_extract(report_json, '$.schemaVersion') AS schemaVersion,
  CASE WHEN report_json IS NOT NULL AND coalesce(json_extract(report_json, '$.schemaVersion'), 0) NOT IN (7, 8)
    THEN 'unsupported_report_version' END AS reportError,
  json_extract(input_json, '$.dryRun') AS dryRun,
  CASE WHEN json_extract(report_json, '$.schemaVersion') IN (7, 8) THEN json_extract(report_json, '$.outcome') END AS outcome,
  CASE WHEN json_extract(report_json, '$.schemaVersion') IN (7, 8) THEN json_extract(report_json, '$.researchStatus') END AS researchStatus
FROM ingestion_runs WHERE id = ?
