import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const restrictedImports = (groups) => [
  "error",
  {
    patterns: groups.map(({ group, message }) => ({ group, message })),
  },
];

const writerImports = {
  group: [
    "@/catalog/write/**",
    "**/catalog/write/**",
    "@/commands/**",
    "**/commands/**",
    "@/ingestion/**",
    "**/ingestion/**",
  ],
  message:
    "Public web code must not import catalog writes or collection commands.",
};

const storageImports = {
  group: [
    "@/db/**",
    "**/db/**",
    "@/site/server/**",
    "**/site/server/**",
    "@/catalog/read/**",
    "!@/catalog/read/contracts",
    "**/catalog/read/**",
    "!**/catalog/read/contracts",
  ],
  message:
    "Browser-facing code must use public catalog contracts, not storage, queries, or request adapters.",
};

const presentationImports = {
  group: [
    "@/app/**",
    "**/app/**",
    "@/features/**",
    "**/features/**",
    "@/components/**",
    "**/components/**",
    "@/site/**",
    "**/site/**",
  ],
  message:
    "Catalog code must not depend on web routes or presentation modules.",
};

const pureModuleImports = {
  group: [
    "react",
    "react/**",
    "next",
    "next/**",
    "@/db/**",
    "**/db/**",
    "@/catalog/write/**",
    "**/catalog/write/**",
  ],
  message:
    "Pure domain and discovery model modules cannot depend on React, Next.js, or storage.",
};

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  prettier,
  {
    files: [
      "src/app/**/*.{ts,tsx}",
      "src/features/**/*.{ts,tsx}",
      "src/components/**/*.{ts,tsx}",
      "src/site/**/*.{ts,tsx}",
    ],
    rules: { "no-restricted-imports": restrictedImports([writerImports]) },
  },
  {
    files: [
      "src/features/**/*.{ts,tsx}",
      "src/components/**/*.{ts,tsx}",
      "src/site/site.ts",
    ],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictedImports([
        writerImports,
        storageImports,
      ]),
    },
  },
  {
    files: ["src/catalog/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictedImports([presentationImports]),
    },
  },
  {
    files: ["src/components/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictedImports([
        writerImports,
        storageImports,
        {
          group: ["@/features/**", "**/features/**", "@/app/**", "**/app/**"],
          message: "Shared components cannot import features or routes.",
        },
      ]),
    },
  },
  {
    files: [
      "src/catalog/domain/**/*.{ts,tsx}",
      "src/catalog/operations/**/*.{ts,tsx}",
      "src/catalog/read/contracts.ts",
      "src/features/discovery/model/**/*.{ts,tsx}",
    ],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictedImports([
        presentationImports,
        pureModuleImports,
      ]),
    },
  },
  globalIgnores([".next/**", "out/**", "node_modules/**", "next-env.d.ts"]),
]);
