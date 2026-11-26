import vocabulary from "@/catalog/taxonomy.json";
import { syncTaxonomy } from "@/catalog/write/sync-taxonomy";
import { openDatabase, openReadDatabase } from "@/db/connection";

try {
  const args = process.argv.slice(2);
  const apply = args.length === 1 && args[0] === "--apply";
  if (args.length && !apply) {
    throw new Error("Usage: pnpm run taxonomy:sync [--apply]");
  }
  const connection = apply
    ? openDatabase(undefined, { fileMustExist: true })
    : openReadDatabase();
  try {
    const { additions, updates, parentDifferences } = syncTaxonomy(
      connection,
      vocabulary,
      apply,
    );
    console.log(
      JSON.stringify({ additions, updates, parentDifferences }, null, 2),
    );
    console.log(
      `Taxonomy ${apply ? "apply" : "preview"}: ${additions.length} additions, ${updates.length} updates, ${parentDifferences.length} parent differences.`,
    );
  } finally {
    connection.client.close();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
