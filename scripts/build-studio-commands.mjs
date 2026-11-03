import { cp } from "node:fs/promises";
import { build } from "esbuild";

await build({
  entryPoints: ["commands/studio-start.ts", "commands/migrate.ts"],
  outdir: ".mastra/output/commands",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
});

for (const output of [".mastra/output", ".mastra/output/commands"]) {
  await cp("src/mastra/catalog-assistant/skills", `${output}/skills`, {
    recursive: true,
  });
}
