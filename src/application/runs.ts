import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { z } from "zod";

const url = z.url().refine((v) => /^https?:\/\//.test(v));
const resultSchema = z
  .object({
    key: z.string().min(1).max(200),
    sourceId: z.string().min(1),
    checkedAt: z.iso.datetime({ offset: true }),
    outcome: z.enum(["changed", "unchanged", "failed", "blocked", "skipped"]),
    inspectedUrl: url,
    authority: z
      .enum(["official", "partner", "secondary", "community"])
      .optional(),
    excerpt: z.string().trim().min(1).max(2000).optional(),
    snapshotRef: z.string().trim().min(1).max(500).optional(),
    errorCode: z.string().max(100).optional(),
  })
  .strict()
  .superRefine((r, ctx) => {
    if (r.outcome === "changed" || r.outcome === "unchanged") {
      if (!r.authority)
        ctx.addIssue({
          code: "custom",
          message: "Successful checks require authority",
        });
      if (!r.excerpt && !r.snapshotRef)
        ctx.addIssue({
          code: "custom",
          message: "Successful checks require an excerpt or snapshot reference",
        });
    }
    if ((r.outcome === "failed" || r.outcome === "blocked") && !r.errorCode)
      ctx.addIssue({
        code: "custom",
        message: "Failed checks require a safe error code",
      });
  });
const startSchema = z
  .object({
    mode: z.enum(["dry_run", "apply"]),
    initiatedBy: z.string().min(1).max(200),
    adapterVersions: z.record(z.string(), z.string().max(100)),
  })
  .strict();
const summarySchema = z
  .object({
    checked: z.number().int().nonnegative(),
    created: z.number().int().nonnegative(),
    updated: z.number().int().nonnegative(),
    published: z.number().int().nonnegative(),
    unchanged: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
  })
  .strict();
type RunResult = z.infer<typeof resultSchema>;
export function startIngestionRun(
  client: Database.Database,
  input: z.input<typeof startSchema>,
) {
  const data = startSchema.parse(input);
  const id = randomUUID();
  client
    .prepare(
      "INSERT INTO ingestion_runs (id,mode,initiated_by,adapter_versions,started_at,status,results) VALUES (?,?,?,?,?,'running','[]')",
    )
    .run(
      id,
      data.mode,
      data.initiatedBy,
      JSON.stringify(data.adapterVersions),
      new Date().toISOString(),
    );
  return id;
}
export function recordSourceCheck(
  client: Database.Database,
  runId: string,
  input: z.input<typeof resultSchema>,
) {
  const result = resultSchema.parse(input);
  return client.transaction(() => {
    const run = client
      .prepare("SELECT status,results FROM ingestion_runs WHERE id=?")
      .get(runId) as { status: string; results: string } | undefined;
    if (!run) throw new Error("Run is not active");
    const results = JSON.parse(run.results) as RunResult[];
    const previous = results.find((x) => x.key === result.key);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(result))
        throw new Error("Run result key reused with different payload");
      return false;
    }
    if (run.status !== "running") throw new Error("Run is not active");
    if (
      !client.prepare("SELECT id FROM sources WHERE id=?").get(result.sourceId)
    )
      throw new Error("Unknown source");
    results.push(result);
    client
      .prepare("UPDATE ingestion_runs SET results=? WHERE id=?")
      .run(JSON.stringify(results), runId);
    return true;
  })();
}
export function finishIngestionRun(
  client: Database.Database,
  runId: string,
  status: "succeeded" | "partially_failed" | "failed",
  input: z.input<typeof summarySchema>,
) {
  const summary = summarySchema.parse(input);
  const updated = client
    .prepare(
      "UPDATE ingestion_runs SET status=?,summary=?,finished_at=? WHERE id=? AND status='running'",
    )
    .run(status, JSON.stringify(summary), new Date().toISOString(), runId);
  if (updated.changes !== 1) throw new Error("Run is not active");
}
