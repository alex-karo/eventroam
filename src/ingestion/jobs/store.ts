import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { z } from "zod";
import { addInputSchema } from "../add-input";

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
export const addJobsInputSchema = z.strictObject({
  inputs: z.array(addInputSchema).min(1).max(200),
  dryRun: z.boolean().default(true),
});

const jobSettings = { dry_run: z.union([z.literal(0), z.literal(1)]) };
const jobTargetSchema = z.union([
  z.object({
    ...jobSettings,
    add_input: addInputSchema,
    event_id: z.null(),
    scope: z.null(),
  }),
  z.object({
    ...jobSettings,
    add_input: z.null(),
    event_id: z.string().trim().min(1).max(500),
    scope: z.enum(["current", "full"]),
  }),
]);

/** Used at queue dispatch and again inside the attempt write transaction. */
export function jobWorkflowInput(
  row: Pick<IngestionJob, "add_input" | "event_id" | "scope" | "dry_run">,
) {
  const job = jobTargetSchema.parse(row);
  const settings = { dryRun: Boolean(job.dry_run), republish: false };
  return job.add_input !== null
    ? { mode: "add" as const, input: job.add_input, ...settings }
    : {
        mode: "refresh" as const,
        eventId: job.event_id,
        scope: job.scope,
        ...settings,
      };
}

export type IngestionJob = {
  id: string;
  batch_id: string;
  position: number;
  add_input: string | null;
  event_id: string | null;
  scope: "current" | "full" | null;
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
      "SELECT id,batch_id,position,add_input,event_id,scope,dry_run,status,created_at FROM ingestion_jobs LIMIT 0",
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
  return submitSelection(
    client,
    eventIds.map((event_id) => ({
      add_input: null,
      event_id,
      scope,
      dry_run: Number(dryRun),
    })),
    consume,
  );
}

export function submitAddJobs(
  client: Database.Database,
  requested: z.input<typeof addJobsInputSchema>,
  consume: () => void = () => {},
) {
  const parsed = addJobsInputSchema.safeParse(requested);
  if (!parsed.success) {
    throw new JobStorageError("invalid_selection");
  }
  return submitSelection(
    client,
    parsed.data.inputs.map((add_input) => ({
      add_input,
      event_id: null,
      scope: null,
      dry_run: Number(parsed.data.dryRun),
    })),
    consume,
  );
}

function submitSelection(
  client: Database.Database,
  targets: Pick<IngestionJob, "add_input" | "event_id" | "scope" | "dry_run">[],
  consume: () => void,
) {
  return write(client, () => {
    probeJobCatalog(client);
    const exists = client.prepare("SELECT id FROM events WHERE id=?");
    for (const target of targets) {
      if (target.event_id !== null && !exists.get(target.event_id)) {
        throw new JobStorageError("invalid_selection");
      }
    }
    // The host flag is acquired after validation. Rollback does not release it.
    consume();
    const batchId = randomUUID();
    const createdAt = new Date().toISOString();
    const insert = client.prepare(
      "INSERT INTO ingestion_jobs(id,batch_id,position,add_input,event_id,scope,dry_run,status,created_at) VALUES(?,?,?,?,?,?,?,'pending',?)",
    );
    targets.forEach((target, position) =>
      insert.run(
        randomUUID(),
        batchId,
        position,
        target.add_input,
        target.event_id,
        target.scope,
        target.dry_run,
        createdAt,
      ),
    );
    return { batchId, acceptedCount: targets.length };
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
