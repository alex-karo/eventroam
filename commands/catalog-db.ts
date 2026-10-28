import { openDatabase } from "@/db/connection";
import { migrateCatalogConnection } from "@/db/migrate";
import { seedDevelopmentFixtures } from "./development-fixtures";

const command = process.argv[2];
if (command !== "migrate" && command !== "fixtures") {
  throw new Error("Usage: pnpm run db:migrate or pnpm run db:fixtures");
}
const connection = openDatabase();
try {
  migrateCatalogConnection(connection);
  if (command === "fixtures") {
    const id = seedDevelopmentFixtures(connection.client);
    console.log(`Development fixture Event: ${id}`);
  } else {
    console.log("Database migrations complete");
  }
} finally {
  connection.client.close();
}
