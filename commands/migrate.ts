import { migrateDatabase } from "../src/db/migrate";

try {
  migrateDatabase();
} catch {
  process.stderr.write(
    "Catalog migration failed. Check the selected file and permissions.\n",
  );
  process.exitCode = 1;
}
