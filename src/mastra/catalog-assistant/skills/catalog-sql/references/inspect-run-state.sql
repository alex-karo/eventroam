SELECT id AS ingestionRunId, event_id, mode, status, started_at, finished_at,
  report_json IS NOT NULL AS reportPresent,
  json_valid(report_json) AS reportValid,
  json_valid(input_json) AS inputValid
FROM ingestion_runs WHERE id = ?
