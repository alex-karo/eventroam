// Offline Studio process fixture for queue interruption and restart.
import Database from "better-sqlite3";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { createStudioIngestionWorkflow } from "../mastra/ingestion";
import { createStudioJobs } from "../mastra/jobs";
import { createStudioStorage } from "../ingestion/evals/storage";
import { createAssistantLogging } from "../mastra/catalog-assistant/logging";
import { createApplicationLogger } from "../ingestion/runtime/logging";
import {
  createChatMemory,
  StudioMastra,
} from "../mastra/catalog-assistant/memory";
import { startStudioServer } from "../mastra/server";
import { openJobCatalog } from "../ingestion/jobs/store";
import { DEFAULT_RESEARCH_LIMITS } from "../ingestion/runtime/budget";
import {
  fixtureDependencies,
  fixtureRoleGenerator,
  fixtureTargets,
  set,
} from "./ingestion";

import type { GenerateRole } from "../ingestion/roles/invoke";

const mode = process.argv[2];
const path = process.env.DATABASE_PATH!;
const read =
  mode === "credentials"
    ? undefined
    : new Database(path, { readonly: true, fileMustExist: true });
const events = read
  ?.prepare("SELECT id,canonical_name,summary FROM events")
  .all() as
  { id: string; canonical_name: string; summary: string | null }[] | undefined;
read?.close();
const deps = {
  config: {
    apiKey: "fixture",
    model: "fixture",
    limits: DEFAULT_RESEARCH_LIMITS,
  },
  ...fixtureDependencies(),
  generateRole: fixtureRoleGenerator({
    research: (async (role, prompt, context) => {
      const event = events!.find((event) => prompt.includes(event.id))!;
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
      const event = events!.find((event) => event.id === eventId)!;
      const targets = fixtureTargets(eventId);
      targets.observedEventName = event.canonical_name;
      targets.event = { summary: set("STUDIO_SAVED_SUMMARY") };
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
  const stores = await createStudioStorage();
  const workflow = createStudioIngestionWorkflow(
    stores.observations,
    mode === "credentials"
      ? undefined
      : async () => {
          const client = openJobCatalog(path);
          return {
            deps: {
              ...deps,
              client,
              observabilityStore: stores.observations,
            },
            close: () => client.close(),
          };
        },
  );
  stores.workflows.setFailureHandler(workflow.historyControl.recoverHistory);
  await stores.storage.init();
  const logging = createAssistantLogging();
  const jobs = createStudioJobs(
    workflow,
    logging && createApplicationLogger(logging),
  );
  const chat = await createChatMemory();
  const mastra = new StudioMastra(
    {
      workflows: { "catalog-ingestion": workflow },
      storage: stores.storage,
      logger: logging?.native ?? false,
      observability: logging?.observability,
      server: { apiRoutes: [jobs.route] },
    },
    chat,
    jobs,
  );
  const server = await startStudioServer(mastra, {
    host: "127.0.0.1",
    port: 0,
  });
  if (!server.listening) {
    await once(server, "listening");
  }
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Fixture address unavailable");
  }
  process.stdout.write(`STUDIO_URL http://127.0.0.1:${address.port}\n`);
}
main().catch(() => {
  process.stderr.write("Studio queue fixture failed\n");
  process.exitCode = 1;
});
