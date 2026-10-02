import { openDatabase } from "@/db/connection";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { seedDevelopmentFixtures } from "./development-fixtures";

const command = process.argv[2];
if (command !== "migrate" && command !== "fixtures")
  throw new Error("Usage: npm run db:migrate or npm run db:fixtures");
const connection = openDatabase();
try {
  migrate(connection.db, { migrationsFolder: "./src/db/migrations" });
  if (command === "fixtures") {
    const id = seedDevelopmentFixtures(connection.client);
    console.log(`Development fixture Event: ${id}`);
  } else console.log("Database migrations complete");
} finally {
  connection.client.close();
}
