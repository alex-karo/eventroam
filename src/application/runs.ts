import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { z } from "zod";
import { ingestionRuns, sources } from "../db/schema";

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
  drizzle(client)
    .insert(ingestionRuns)
    .values({
      id,
      mode: data.mode,
      initiatedBy: data.initiatedBy,
      adapterVersions: data.adapterVersions,
      startedAt: new Date().toISOString(),
      status: "running",
      results: [],
    })
    .run();
  return id;
}
export function recordSourceCheck(
  client: Database.Database,
  runId: string,
  input: z.input<typeof resultSchema>,
) {
  const result = resultSchema.parse(input);
  return drizzle(client).transaction((tx) => {
    const run = tx
      .select({ status: ingestionRuns.status, results: ingestionRuns.results })
      .from(ingestionRuns)
      .where(eq(ingestionRuns.id, runId))
      .get();
    if (!run) throw new Error("Run is not active");
    const results = (run.results ?? []) as RunResult[];
    const previous = results.find((x) => x.key === result.key);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(result))
        throw new Error("Run result key reused with different payload");
      return false;
    }
    if (run.status !== "running") throw new Error("Run is not active");
    if (
      !tx
        .select({ id: sources.id })
        .from(sources)
        .where(eq(sources.id, result.sourceId))
        .get()
    )
      throw new Error("Unknown source");
    results.push(result);
    tx.update(ingestionRuns)
      .set({ results })
      .where(eq(ingestionRuns.id, runId))
      .run();
    return true;
  });
}
export function finishIngestionRun(
  client: Database.Database,
  runId: string,
  status: "succeeded" | "partially_failed" | "failed",
  input: z.input<typeof summarySchema>,
) {
  const summary = summarySchema.parse(input);
  const updated = drizzle(client)
    .update(ingestionRuns)
    .set({
      status,
      summary,
      finishedAt: new Date().toISOString(),
    })
    .where(
      and(eq(ingestionRuns.id, runId), eq(ingestionRuns.status, "running")),
    )
    .run();
  if (updated.changes !== 1) throw new Error("Run is not active");
}
