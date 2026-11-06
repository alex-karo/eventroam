import type { EvalCase } from "./fixtures";
import type { ReaderEvalCase } from "./reader";
import type { ClassificationEvalCase } from "./classification";

export type SelectedEvalCase =
  EvalCase | ReaderEvalCase | ClassificationEvalCase;

export const evalGroups = [
  "main/pipeline",
  "regression/pipeline",
  "regression/editor",
  "regression/location",
  "regression/reader",
  "regression/classification",
] as const;
export type EvalGroup = (typeof evalGroups)[number];
export type EvalSelection = {
  all?: boolean;
  editorOnly?: boolean;
  locationOnly?: boolean;
  caseIds?: string[];
  groups?: EvalGroup[];
};
export function caseGroup(item: SelectedEvalCase): EvalGroup {
  if ("classification" in item) {
    return "regression/classification";
  }
  if ("reader" in item) {
    return "regression/reader";
  }
  if (item.location) {
    return "regression/location";
  }
  if (item.roleHandoff) {
    return "regression/editor";
  }
  return item.suite === "main" ? "main/pipeline" : "regression/pipeline";
}
export function selectEvalCases(
  suite: { cases: SelectedEvalCase[] },
  options: EvalSelection,
) {
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
      return "roleHandoff" in item && !!item.roleHandoff;
    }
    if (options.locationOnly) {
      return "location" in item && !!item.location;
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
