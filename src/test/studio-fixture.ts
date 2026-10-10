import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { openDatabase } from "../db/connection";
import { testFixtures } from "./fixtures";

export type StudioScenario =
  | "success"
  | "partial"
  | "failure"
  | "cancel"
  | "agent"
  | "persistence"
  | "agent-cancel"
  | "agent-persistence"
  | "agent-recording";
export const STUDIO_FIXTURE_EVENT_ID = "00000000-0000-4000-8000-000000000001";

function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate fixture port"));
        return;
      }
      server.close(() => resolvePort(address.port));
    });
  });
}

export async function startStudioFixture(
  scenario: StudioScenario = "success",
  options: { port?: number; root?: string; catalog?: boolean } = {},
) {
  const root = options.root ?? process.cwd();
  const directory = mkdtempSync(join(tmpdir(), "eventroam-studio-"));
  for (const file of ["node_modules", "package.json", "tsconfig.json"]) {
    symlinkSync(resolve(root, file), join(directory, file));
  }
  const catalogPath = join(directory, "catalog.sqlite");
  const tracePath = join(directory, "observability.duckdb");
  if (options.catalog !== false) {
    const connection = openDatabase(catalogPath);
    try {
      migrate(connection.db, {
        migrationsFolder: resolve(root, "src/db/migrations"),
      });
      const fixtures = testFixtures(connection.client);
      const event = fixtures.event({
        id: STUDIO_FIXTURE_EVENT_ID,
        canonicalName: "Studio Fixture Festival",
      });
      fixtures.eventLink(event, { url: "https://example.org/studio-fixture" });
      if (scenario === "persistence" || scenario === "agent-persistence") {
        connection.client.exec(
          "CREATE TRIGGER fail_studio_finalize BEFORE UPDATE ON ingestion_runs BEGIN SELECT RAISE(FAIL, 'PRIVATE_STUDIO_FIXTURE_SENTINEL'); END",
        );
      }
    } finally {
      connection.client.close();
    }
  }

  const port = options.port ?? (await freePort());
  const child = spawn(
    process.execPath,
    [
      resolve(root, "node_modules/mastra/dist/index.js"),
      "dev",
      "--dir",
      resolve(root, "src/test/studio-fixture/mastra"),
      "--root",
      directory,
    ],
    {
      cwd: directory,
      env: {
        ...process.env,
        DATABASE_PATH: catalogPath,
        CATALOG_OBSERVABILITY_DATABASE_PATH: tracePath,
        CATALOG_TRACING: scenario === "agent-recording" ? "true" : "false",
        CATALOG_LOGGING: scenario === "agent-recording" ? "true" : "false",
        STUDIO_FIXTURE_SCENARIO: scenario,
        STUDIO_FIXTURE_PORT: String(port),
        OPENROUTER_API_KEY: "OFFLINE_FIXTURE_ONLY",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  const append = (chunk: Buffer) => {
    output = (output + chunk.toString()).slice(-12_000);
  };
  child.stdout?.on("data", append);
  child.stderr?.on("data", append);
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) {
        throw new Error(`Fixture server exited: ${output}`);
      }
      try {
        const response = await fetch(
          `${baseUrl}/api/workflows/catalog-ingestion`,
        );
        if (response.ok) {
          return {
            baseUrl,
            catalogPath,
            tracePath,
            directory,
            child,
            output: () => output,
            stop: (preserve = false) =>
              stopStudioFixture(child, directory, preserve),
          };
        }
      } catch {
        /* Wait for the actual HTTP server. */
      }
      await new Promise((resolveWait) => setTimeout(resolveWait, 200));
    }
    throw new Error(`Fixture server did not become ready: ${output}`);
  } catch (error) {
    await stopStudioFixture(child, directory);
    throw error;
  }
}

async function stopStudioFixture(
  child: ChildProcess,
  directory: string,
  preserve = false,
) {
  if (child.exitCode === null) {
    child.kill("SIGTERM");
    await Promise.race([
      new Promise<void>((resolveExit) =>
        child.once("exit", () => resolveExit()),
      ),
      new Promise<void>((resolveWait) => setTimeout(resolveWait, 3_000)),
    ]);
    if (child.exitCode === null) {
      child.kill("SIGKILL");
    }
  }
  if (!preserve) {
    rmSync(directory, { recursive: true, force: true });
  }
}

if (process.argv[1]?.endsWith("studio-fixture.ts")) {
  const scenario = (process.argv[2] ?? "success") as StudioScenario;
  startStudioFixture(scenario, {
    port: Number(process.env.STUDIO_FIXTURE_PORT ?? 4111),
  })
    .then((fixture) => {
      process.stdout.write(`Offline Studio fixture: ${fixture.baseUrl}\n`);
      process.stdout.write(`Event ID: ${STUDIO_FIXTURE_EVENT_ID}\n`);
      process.stdout.write(`Catalog: ${fixture.catalogPath}\n`);
      const stop = () => void fixture.stop().then(() => process.exit(0));
      process.on("SIGINT", stop);
      process.on("SIGTERM", stop);
    })
    .catch((error) => {
      process.stderr.write(`${error}\n`);
      process.exitCode = 1;
    });
}
