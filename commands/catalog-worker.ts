import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readDatabaseEnvironment } from "../src/db/env";
import { runIngestionWorker } from "../src/ingestion/jobs/worker";

export async function workerCommand() {
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  try {
    await runIngestionWorker({
      catalogPath: readDatabaseEnvironment().DATABASE_PATH,
      signal: controller.signal,
    });
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  workerCommand().catch(() => {
    console.error(
      "Ingestion worker stopped. Check catalog and diagnostic storage.",
    );
    process.exitCode = 1;
  });
}
