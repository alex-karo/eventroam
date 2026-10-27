import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "commands/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}", "commands/**/*.{ts,tsx}"],
      exclude: [
        "src/test/**",
        "src/ingestion/evals/**",
        "commands/catalog-eval.ts",
        "**/*.test.{ts,tsx}",
        "**/*.d.ts",
      ],
      reporter: ["text", "html", "json-summary"],
    },
  },
});
