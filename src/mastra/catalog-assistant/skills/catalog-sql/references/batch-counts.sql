SELECT status, count(*) AS count
FROM ingestion_jobs
WHERE batch_id = ?
GROUP BY status
ORDER BY status
