SELECT evidence.key AS itemIndex, evidence.value AS evidence
FROM ingestion_runs AS run,
  json_each(run.report_json, '$.changes') AS evidence
WHERE run.id = ? ORDER BY evidence.key LIMIT 20
