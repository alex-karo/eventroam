SELECT j.position, j.status AS jobStatus, j.dry_run AS jobPreview,
  r.id AS ingestionRunId, r.status AS runStatus, r.event_id AS savedEventId,
  json_valid(r.input_json) AS inputValid,
  r.report_json IS NOT NULL AS reportPresent,
  json_valid(r.report_json) AS reportValid,
  json_extract(r.input_json, '$.dryRun') AS preview,
  json_extract(r.report_json, '$.schemaVersion') AS schemaVersion,
  json_extract(r.report_json, '$.outcome') AS outcome,
  json_extract(r.report_json, '$.eventId') AS reportedEventId,
  coalesce(json_extract(r.report_json, '$.modelResponse.object.result.decision'), json_extract(r.report_json, '$.modelResponse.object.decision')) AS identityDecision,
  coalesce(json_extract(r.report_json, '$.modelResponse.object.result.reason'), json_extract(r.report_json, '$.modelResponse.object.reason')) AS identityReason,
  json_extract(r.report_json, '$.editorResponse.object.item.decision') AS editorItemDecision,
  json_extract(r.report_json, '$.editorResponse.object.item.reason') AS editorItemReason,
  json_extract(r.report_json, '$.editorResponse.object.event.target.decision') AS editorTargetDecision,
  json_extract(r.report_json, '$.editorResponse.object.event.target.reason') AS editorTargetReason,
  EXISTS (
    SELECT 1 FROM json_each(r.report_json, '$.errors') error
    WHERE json_extract(error.value, '$.code') = 'editor_rejected'
  ) AS editorRejected,
  EXISTS (
    SELECT 1 FROM json_each(r.report_json, '$.operations') op
    WHERE json_extract(op.value, '$.kind') = 'createEvent'
  ) AS proposedCreation,
  EXISTS (
    SELECT 1 FROM json_each(r.report_json, '$.operations') op
    JOIN json_each(r.report_json, '$.receipts') receipt ON receipt.key = op.key
    WHERE json_extract(op.value, '$.kind') = 'createEvent'
      AND json_extract(receipt.value, '$.changed') = 1
  ) AS changedCreation
FROM ingestion_jobs j LEFT JOIN ingestion_runs r ON r.job_id = j.id
WHERE j.batch_id = ? AND j.add_input IS NOT NULL
ORDER BY j.position, r.started_at, r.id
