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
