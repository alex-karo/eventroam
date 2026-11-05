WITH jobs AS (
  SELECT id, position, mode, dry_run, status, created_at,
    CASE WHEN json_valid(input) THEN input END AS readableInput
  FROM ingestion_jobs
  WHERE batch_id = ?
)
SELECT id, position, mode, dry_run, status, created_at,
  CASE WHEN mode = 'refresh' THEN json_extract(readableInput, '$.eventId') END AS eventId,
  CASE WHEN mode = 'refresh' THEN json_extract(readableInput, '$.scope') END AS scope,
  CASE WHEN mode = 'add' THEN substr(json_extract(readableInput, '$'), 1, 160) END AS inputExcerpt
FROM jobs
ORDER BY position
