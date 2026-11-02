import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { z } from "zod";

export const refreshInputSchema = z.strictObject({
  eventIds: z
    .array(z.string().trim().min(1).max(500))
    .min(1)
    .max(200)
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "Event IDs must be distinct",
    ),
  scope: z.enum(["current", "full"]).default("full"),
  dryRun: z.boolean().default(true),
});
export type IngestionJob = {
  id: string;
  batch_id: string;
  position: number;
  event_id: string;
  scope: "current" | "full";
  dry_run: number;
  status: "pending" | "running" | "done" | "cancelled";
  created_at: string;
};
export class JobStorageError extends Error {
  constructor(
    readonly code:
      | "invalid_selection"
      | "selection_consumed"
      | "batch_not_found"
      | "job_storage_unavailable",
  ) {
    super(code);
  }
}

/** Open only existing, migrated catalog storage. Never create or migrate it. */
export function openJobCatalog(path: string) {
  let client: Database.Database | undefined;
  try {
    client = new Database(path, { fileMustExist: true });
    client.pragma("foreign_keys = ON");
    client.pragma("busy_timeout = 5000");
    probeJobCatalog(client);
    return client;
  } catch {
    client?.close();
    throw new JobStorageError("job_storage_unavailable");
  }
}

function probeJobCatalog(client: Database.Database) {
  client
    .prepare(
      "SELECT id,batch_id,position,event_id,scope,dry_run,status,created_at FROM ingestion_jobs LIMIT 0",
    )
    .all();
  client
    .prepare(
      "SELECT id,job_id,input_json,report_json FROM ingestion_runs LIMIT 0",
    )
    .all();
  client.prepare("SELECT id FROM events LIMIT 0").all();
}

function write<T>(client: Database.Database, operation: () => T): T {
  try {
    if (client.inTransaction) {
      throw new Error("Job writes need their own transaction");
    }
    return client.transaction(operation).immediate();
  } catch (error) {
    if (error instanceof JobStorageError) {
      throw error;
    }
    throw new JobStorageError("job_storage_unavailable");
  }
}

export function submitJobs(
  client: Database.Database,
  requested: z.input<typeof refreshInputSchema>,
  consume: () => void = () => {},
) {
  const parsed = refreshInputSchema.safeParse(requested);
  if (!parsed.success) {
    throw new JobStorageError("invalid_selection");
  }
  const { eventIds, scope, dryRun } = parsed.data;
  return write(client, () => {
    probeJobCatalog(client);
    const exists = client.prepare("SELECT id FROM events WHERE id=?");
    if (eventIds.some((id) => !exists.get(id))) {
      throw new JobStorageError("invalid_selection");
    }
    // The host flag is acquired after validation. Rollback does not release it.
    consume();
    const batchId = randomUUID();
    const createdAt = new Date().toISOString();
    const insert = client.prepare(
      "INSERT INTO ingestion_jobs(id,batch_id,position,event_id,scope,dry_run,status,created_at) VALUES(?,?,?,?,?,?,'pending',?)",
    );
    eventIds.forEach((id, position) =>
      insert.run(
        randomUUID(),
        batchId,
        position,
        id,
        scope,
        Number(dryRun),
        createdAt,
      ),
    );
    return { batchId, acceptedCount: eventIds.length };
  });
}

export function nextJob(client: Database.Database): IngestionJob | undefined {
  return write(client, () => {
    const job = client
      .prepare(
        "SELECT * FROM ingestion_jobs WHERE status IN ('pending','running') ORDER BY created_at,batch_id,position LIMIT 1",
      )
      .get() as IngestionJob | undefined;
    if (job?.status === "pending") {
      const update = client
        .prepare(
          "UPDATE ingestion_jobs SET status='running' WHERE id=? AND status='pending'",
        )
        .run(job.id);
      if (update.changes !== 1) {
        throw new Error("Job start failed");
      }
      job.status = "running";
    }
    return job;
  });
}

export function finishJob(client: Database.Database, jobId: string) {
  write(client, () => {
    if (
      client
        .prepare(
          "UPDATE ingestion_jobs SET status='done' WHERE id=? AND status='running'",
        )
        .run(jobId).changes !== 1
    ) {
      throw new Error("Job completion failed");
    }
  });
}

export function cancelPendingJobs(
  client: Database.Database,
  requested: string,
) {
  const batchId = z.uuid().parse(requested);
  return write(client, () => {
    if (
      !client
        .prepare("SELECT id FROM ingestion_jobs WHERE batch_id=? LIMIT 1")
        .get(batchId)
    ) {
      throw new JobStorageError("batch_not_found");
    }
    const cancelledCount = client
      .prepare(
        "UPDATE ingestion_jobs SET status='cancelled' WHERE batch_id=? AND status='pending'",
      )
      .run(batchId).changes;
    const counts = client
      .prepare(
        "SELECT status,count(*) AS count FROM ingestion_jobs WHERE batch_id=? GROUP BY status",
      )
      .all(batchId) as { status: string; count: number }[];
    return { batchId, cancelledCount, counts };
  });
}
