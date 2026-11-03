// Offline process fixture for queue interruption and real worker startup.
import Database from "better-sqlite3";
import { setTimeout as delay } from "node:timers/promises";
import { runIngestionWorker } from "../ingestion/jobs/worker";
import { processJobs } from "../ingestion/jobs/processor";
import { openJobCatalog } from "../ingestion/jobs/store";
import { runCatalogResearch } from "../ingestion/workflow";
import { createWorkflowStorage } from "../ingestion/runtime/workflow-storage";
import { DEFAULT_RESEARCH_LIMITS } from "../ingestion/runtime/budget";
import {
  fixtureDependencies,
  fixtureRoleGenerator,
  fixtureTargets,
  set,
} from "./ingestion";

import type { GenerateRole } from "../ingestion/roles/invoke";

const controller = new AbortController();
const stop = () => controller.abort();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
const mode = process.argv[2];
const path = process.env.DATABASE_PATH!;
const read = new Database(path, { readonly: true, fileMustExist: true });
const events = read
  .prepare("SELECT id,canonical_name,summary FROM events")
  .all() as { id: string; canonical_name: string; summary: string | null }[];
read.close();
const deps = {
  config: {
    apiKey: "fixture",
    model: "fixture",
    limits: DEFAULT_RESEARCH_LIMITS,
  },
  ...fixtureDependencies(),
  generateRole: fixtureRoleGenerator({
    research: (async (role, prompt, context) => {
      const event = events.find((event) => prompt.includes(event.id))!;
      process.stdout.write(
        `RESEARCH ${JSON.stringify({ id: event.id, summary: event.summary })}\n`,
      );
      if (mode === "interrupt") {
        await new Promise(() => setInterval(() => {}, 1000));
      }
      if (mode === "signal") {
        await delay(1500);
      }
      return fixtureRoleGenerator()(role, prompt, context);
    }) satisfies GenerateRole,
    general: (async (_role, prompt) => {
      const data = JSON.parse(prompt);
      const eventId = data.assignment.identityContext.eventId;
      const event = events.find((event) => event.id === eventId)!;
      const targets = fixtureTargets(eventId);
      targets.observedEventName = event.canonical_name;
      targets.event = { summary: set("WORKER_SAVED_SUMMARY") };
      targets.previousEdition = null;
      targets.currentOrNextEdition = null;
      return targets;
    }) satisfies GenerateRole,
  }),
  searchWeb: async () => {
    throw new Error("Unexpected fixture search");
  },
};

async function main() {
  if (mode === "before-attempt" || mode === "after-finalize") {
    const client = openJobCatalog(path);
    const storage = createWorkflowStorage({
      path: process.env.CATALOG_WORKFLOW_DATABASE_PATH,
    });
    try {
      await storage.init();
      await processJobs({
        client,
        signal: controller.signal,
        execute: async (job) => {
          if (mode === "after-finalize") {
            await runCatalogResearch(
              {
                mode: "refresh",
                eventId: job.event_id,
                scope: job.scope,
                dryRun: Boolean(job.dry_run),
                actor: "fixture",
              },
              { ...deps, client, jobId: job.id, workflowStorage: storage },
            );
          }
          process.stdout.write("PAUSED\n");
          await new Promise(() => setInterval(() => {}, 1000));
        },
      });
    } finally {
      await storage.close();
      client.close();
    }
  } else {
    await runIngestionWorker({
      catalogPath: path,
      signal: controller.signal,
      researchDependencies: deps,
    });
  }
}
main()
  .catch(() => {
    process.stderr.write("Worker fixture failed\n");
    process.exitCode = 1;
  })
  .finally(() => {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  });
