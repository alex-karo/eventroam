import { readDatabaseEnvironment } from "../src/db/env";
import { runIngestionWorker } from "../src/ingestion/jobs/worker";

async function workerCommand() {
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

workerCommand().catch(() => {
  console.error(
    "Ingestion worker stopped. Check catalog and diagnostic storage.",
  );
  process.exitCode = 1;
});
