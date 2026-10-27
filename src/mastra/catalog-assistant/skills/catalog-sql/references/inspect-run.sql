SELECT id AS ingestionRunId, event_id, mode, status, started_at, finished_at,
  report_json IS NOT NULL AS reportPresent,
  json_valid(report_json) AS reportValid,
  json_extract(report_json, '$.schemaVersion') AS schemaVersion,
  json_extract(input_json, '$.dryRun') AS dryRun,
  json_extract(report_json, '$.outcome') AS outcome,
  json_extract(report_json, '$.researchStatus') AS researchStatus
FROM ingestion_runs WHERE id = ?
