import type { EvalCase, EvalSuite } from "./fixtures";

export const evalGroups = [
  "main/pipeline",
  "regression/pipeline",
  "regression/editor",
  "regression/location",
] as const;
export type EvalGroup = (typeof evalGroups)[number];
export type EvalSelection = {
  all?: boolean;
  editorOnly?: boolean;
  locationOnly?: boolean;
  caseIds?: string[];
  groups?: EvalGroup[];
};
export function caseGroup(item: EvalCase): EvalGroup {
  if (item.location) {
    return "regression/location";
  }
  if (item.researchHandoff) {
    return "regression/editor";
  }
  return item.suite === "main" ? "main/pipeline" : "regression/pipeline";
}
export function selectEvalCases(suite: EvalSuite, options: EvalSelection) {
  if (
    [
      options.all,
      options.editorOnly,
      options.locationOnly,
      !!options.groups?.length,
    ].filter(Boolean).length > 1
  ) {
    throw new Error(
      "Use one of --all, --editor-only, --location-only, or --group",
    );
  }
  if (
    options.caseIds?.some((id) => !suite.cases.some((item) => item.id === id))
  ) {
    throw new Error("Unknown eval case selection");
  }
  const selected = suite.cases.filter((item) => {
    if (options.caseIds?.length && !options.caseIds.includes(item.id)) {
      return false;
    }
    if (options.editorOnly) {
      return !!item.researchHandoff;
    }
    if (options.locationOnly) {
      return !!item.location;
    }
    if (options.groups?.length) {
      return options.groups.includes(caseGroup(item));
    }
    return Boolean(
      options.all || options.caseIds?.length || item.suite === "main",
    );
  });
  if (
    !selected.length ||
    (options.caseIds?.length &&
      selected.length !== new Set(options.caseIds).size)
  ) {
    throw new Error("Unknown or incompatible eval case selection");
  }
  return selected;
}
