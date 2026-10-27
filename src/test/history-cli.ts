// Offline owner CLI process used by history reopen and interruption checks.
import Database from "better-sqlite3";
import { executeCatalogCommand } from "../../commands/catalog";
import { generateFixtureEditor, generateFixtureLocation } from "./ingestion";

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
    researchDependencies: {
      generateEditor: generateFixtureEditor,
      generateLocation: generateFixtureLocation,
      generateCandidate: async (prompt) => {
        if (interrupt) {
          process.stdout.write("FIXTURE_RESEARCH_WAITING\n");
          await new Promise(() => setInterval(() => {}, 1000));
        }
        if (failed) {
          return {
            status: "failed",
            data: null,
            errors: ["Offline research failure"],
            unresolved: [],
          };
        }
        const event = events.find((item) => prompt.includes(item.id))!;
        return {
          status: "success",
          errors: [],
          unresolved: [],
          data: {
            eventId: event.id,
            eventName: event.canonical_name,
            summary: {
              value: "CLI_FIXTURE_SUMMARY",
              reason: "Offline fixture",
            },
            sources: [],
            links: { socials: {} },
            previousEdition: null,
            currentOrNextEdition: null,
          },
        };
      },
      readPage: async (url, { budget }) => {
        budget.consumePage();
        return {
          attemptedUrl: url,
          finalUrl: url,
          retrievedAt: "2026-10-27T00:00:00Z",
          method: "http",
          outcome: "ok",
          completeness: "full",
          markdown: "PRIVATE_CLI_PAGE_BODY",
          links: [],
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
