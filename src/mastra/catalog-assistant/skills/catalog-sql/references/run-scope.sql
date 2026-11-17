SELECT id AS ingestionRunId,
  json_extract(input_json, '$.scope') AS submittedScope,
  json_extract(report_json, '$.schemaVersion') AS schemaVersion,
  CASE WHEN report_json IS NOT NULL AND coalesce(json_extract(report_json, '$.schemaVersion'), 0) NOT IN (7, 8)
    THEN 'unsupported_report_version' END AS reportError,
  CASE WHEN json_extract(report_json, '$.schemaVersion') = 8 THEN json_extract(report_json, '$.normalizedScope') END AS normalizedScope,
  CASE WHEN json_extract(report_json, '$.schemaVersion') = 8 THEN json_extract(report_json, '$.targets') END AS targets,
  CASE WHEN json_extract(report_json, '$.schemaVersion') = 8 THEN json_extract(report_json, '$.checks.collection') END AS collectionChecks,
  CASE WHEN json_extract(report_json, '$.schemaVersion') = 8 THEN json_extract(report_json, '$.checks.interpretation') END AS interpretationChecks,
  CASE WHEN json_extract(report_json, '$.schemaVersion') = 8 THEN json_extract(report_json, '$.skipped') END AS skipped
FROM ingestion_runs WHERE id = ?
