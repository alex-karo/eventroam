const config = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-unresolved",
      severity: "error",
      from: {},
      // Next.js provides this virtual marker through its compiler aliases.
      to: { couldNotResolve: true, pathNot: "^server-only$" },
    },
    {
      name: "no-production-to-test",
      severity: "error",
      from: { pathNot: "\\.test\\.[cm]?[jt]sx?$|^src/test/" },
      to: { path: "\\.test\\.[cm]?[jt]sx?$|^src/test/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    // Analyze dependencies retained after TypeScript compilation.
    tsPreCompilationDeps: false,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
  },
};

export default config;
