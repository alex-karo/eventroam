import { openReadDatabase } from "@/db/connection";
import {
  events,
  editions,
  externalLinks,
  editionTerms,
  taxonomyTerms,
  urlAliases,
} from "@/db/schema";

export function catalogAvailable(): boolean {
  let connection: ReturnType<typeof openReadDatabase> | undefined;
  try {
    connection = openReadDatabase();
    for (const table of [
      events,
      editions,
      externalLinks,
      editionTerms,
      taxonomyTerms,
      urlAliases,
    ]) {
      connection.db.select().from(table).limit(0).all();
    }
    return true;
  } catch {
    return false;
  } finally {
    connection?.client.close();
  }
}
