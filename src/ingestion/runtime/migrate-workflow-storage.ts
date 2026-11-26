import Database from "better-sqlite3";
import { createWorkflowStorage } from "./workflow-storage";

export async function migrateWorkflowStorage(path: string) {
  const storage = createWorkflowStorage({ path });
  try {
    await storage.init();
  } finally {
    await storage.close();
  }

  const client = new Database(path, { fileMustExist: true });
  try {
    client.transaction(() => {
      // Match the status filter and sort order in Mastra's workflow queries.
      client.exec(`
        CREATE INDEX IF NOT EXISTS eventroam_workflow_snapshot_status_idx
          ON mastra_workflow_snapshot (json_extract(snapshot, '$.status'));
        CREATE INDEX IF NOT EXISTS eventroam_workflow_snapshot_recent_idx
          ON mastra_workflow_snapshot (workflow_name, createdAt DESC);
      `);
    })();
  } finally {
    client.close();
  }
}
