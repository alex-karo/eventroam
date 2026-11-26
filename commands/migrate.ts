import { migrateDatabase } from "../src/db/migrate";
import { migrateWorkflowStorage } from "../src/ingestion/runtime/migrate-workflow-storage";
import { diagnosticStoragePaths } from "../src/ingestion/runtime/storage-paths";

async function migrate() {
  const { workflow } = diagnosticStoragePaths();
  migrateDatabase();
  await migrateWorkflowStorage(workflow);
}

migrate().catch(() => {
  process.stderr.write(
    "Database migration failed. Check the catalog and workflow database paths and permissions.\n",
  );
  process.exitCode = 1;
});
