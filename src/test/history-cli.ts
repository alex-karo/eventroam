// Offline owner CLI process used by history reopen and interruption checks.
import Database from "better-sqlite3";
import { createWorkflowStorage } from "../ingestion/runtime/workflow-storage";
import { executeCatalogCommand } from "../../commands/catalog";
import {
  runFixtureResearch,
  fixtureDependencies,
  fixtureTargets,
  set,
  generateFixtureLocation,
} from "./ingestion";

const args = process.argv.slice(2);
const interrupt = args.includes("--fixture-interrupt");
const failed = args.includes("--fixture-failed");
const catalog = new Database(process.env.DATABASE_PATH, { readonly: true });
const events = catalog
  .prepare("SELECT id,canonical_name FROM events")
  .all() as { id: string; canonical_name: string }[];
catalog.close();
executeCatalogCommand(
  args.filter((arg) => !arg.startsWith("--fixture-")),
  {
    research: async (input, deps) => {
      const storage = createWorkflowStorage();
      try {
        return await runFixtureResearch(input, {
          ...deps,
          workflowStorage: storage,
        });
      } finally {
        await storage.close();
      }
    },
    researchDependencies: {
      ...fixtureDependencies(),
      generateLocation: generateFixtureLocation,
      generateRoles: {
        general: async (_role, prompt) => {
          if (interrupt) {
            process.stdout.write("FIXTURE_RESEARCH_WAITING\n");
            await new Promise(() => setInterval(() => {}, 1000));
          }
          if (failed) {
            return {
              decision: "uncertain",
              reason: "Offline research failure",
              unresolved: [],
            };
          }
          const event = events.find(
            (item) =>
              item.id === JSON.parse(prompt).assignment.identityContext.eventId,
          )!;
          return {
            ...fixtureTargets(event.id),
            observedEventName: event.canonical_name,
            event: { summary: set("CLI_FIXTURE_SUMMARY", "Offline fixture") },
            previousEdition: null,
            currentOrNextEdition: null,
          };
        },
      },
      readPage: async (url, { budget }) => {
        budget.consumePage();
        return {
          attemptedUrl: url,
          finalUrl: url,
          retrievedAt: "2026-10-27T00:00:00Z",
          method: "http",
          status: "ok",
          markdown: "PRIVATE_CLI_PAGE_BODY",
        };
      },
      searchWeb: async () => {
        throw new Error("Unexpected fixture search");
      },
    },
  },
)
  .then((code) => {
    process.exitCode = code;
  })
  .catch(() => {
    process.stderr.write("Offline CLI fixture failed\n");
    process.exitCode = 1;
  });
