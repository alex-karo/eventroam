import { afterEach, beforeEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beginTestDatabase, endTestDatabase } from "@/test/database";
import { closeFixtureWorkflowStores } from "@/test/workflow-stores";
let historyDirectory: string;
beforeEach(() => {
  beginTestDatabase();
  historyDirectory = mkdtempSync(join(tmpdir(), "eventroam-test-history-"));
  vi.stubEnv(
    "CATALOG_WORKFLOW_DATABASE_PATH",
    join(historyDirectory, "workflows.sqlite"),
  );
});
afterEach(async () => {
  await closeFixtureWorkflowStores();
  endTestDatabase();
  vi.unstubAllEnvs();
  rmSync(historyDirectory, { recursive: true, force: true });
});
