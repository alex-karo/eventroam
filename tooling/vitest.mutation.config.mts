import { defineConfig } from "vitest/config";
import base from "../vitest.config.mts";

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: [
      "src/catalog/domain/**/*.test.ts",
      "src/catalog/write/**/*.test.ts",
      "src/db/validation-boundary.test.ts",
      "src/features/discovery/model/discovery.test.ts",
      "src/ingestion/**/*.test.{ts,tsx}",
      "src/mastra/ingestion*.test.ts",
      "src/test/fixtures.test.ts",
    ],
  },
});
