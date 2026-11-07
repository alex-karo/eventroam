WITH runs AS (
  SELECT *,
    CASE WHEN json_valid(input_json) THEN input_json END AS readableInput,
    CASE WHEN json_valid(report_json) THEN report_json END AS readableReport
  FROM ingestion_runs
)
SELECT j.position, j.status AS jobStatus, j.dry_run AS jobPreview,
  r.id AS ingestionRunId, r.status AS runStatus, r.event_id AS savedEventId,
  json_valid(r.input_json) AS inputValid,
  r.report_json IS NOT NULL AS reportPresent,
  json_valid(r.report_json) AS reportValid,
  json_extract(r.readableInput, '$.dryRun') AS preview,
  json_extract(r.readableReport, '$.schemaVersion') AS schemaVersion,
  json_extract(r.readableReport, '$.outcome') AS outcome,
  json_extract(r.readableReport, '$.eventId') AS reportedEventId,
  coalesce(json_extract(r.readableReport, '$.modelResponse.object.result.decision'), json_extract(r.readableReport, '$.modelResponse.object.decision')) AS identityDecision,
  coalesce(json_extract(r.readableReport, '$.modelResponse.object.result.reason'), json_extract(r.readableReport, '$.modelResponse.object.reason')) AS identityReason,
  json_extract(CASE WHEN item.type = 'object' THEN item.value END, '$.decision') AS editorItemDecision,
  json_extract(CASE WHEN item.type = 'object' THEN item.value END, '$.note') AS editorItemReason,
  json_extract(CASE WHEN target.type = 'object' THEN target.value END, '$.decision') AS editorTargetDecision,
  json_extract(CASE WHEN target.type = 'object' THEN target.value END, '$.note') AS editorTargetReason,
  EXISTS (
    SELECT 1 FROM json_each(r.readableReport, '$.errors') error
    WHERE json_extract(CASE WHEN error.type = 'object' THEN error.value END, '$.code') = 'editor_rejected'
  ) AS editorRejected,
  EXISTS (
    SELECT 1 FROM json_each(r.readableReport, '$.operations') op
    WHERE json_extract(CASE WHEN op.type = 'object' THEN op.value END, '$.kind') = 'createEvent'
  ) AS proposedCreation,
  EXISTS (
    SELECT 1 FROM json_each(r.readableReport, '$.operations') op
    JOIN json_each(r.readableReport, '$.receipts') receipt ON receipt.key = op.key
    WHERE json_extract(CASE WHEN op.type = 'object' THEN op.value END, '$.kind') = 'createEvent'
      AND json_extract(CASE WHEN receipt.type = 'object' THEN receipt.value END, '$.changed') = 1
  ) AS changedCreation
FROM ingestion_jobs j LEFT JOIN runs r ON r.job_id = j.id
LEFT JOIN json_each(r.readableReport, '$.editorResponse.object.decisions') item
  ON item.key = (
    SELECT decision.key FROM json_each(r.readableReport, '$.editorResponse.object.decisions') decision
    WHERE json_extract(CASE WHEN decision.type = 'object' THEN decision.value END, '$.path') = 'item'
    LIMIT 1
  )
LEFT JOIN json_each(r.readableReport, '$.editorResponse.object.decisions') target
  ON target.key = (
    SELECT decision.key FROM json_each(r.readableReport, '$.editorResponse.object.decisions') decision
    WHERE json_extract(CASE WHEN decision.type = 'object' THEN decision.value END, '$.path') = 'event.target'
    LIMIT 1
  )
WHERE j.batch_id = ? AND j.mode = 'add'
ORDER BY j.position, r.started_at, r.id
