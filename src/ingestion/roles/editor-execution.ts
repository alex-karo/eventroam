import type { ResearchError } from "../research/contracts";

export type EditorExecution = {
  status: "success" | "failed" | "not_run";
  modelResponse: { text: string | null; object: unknown } | null;
  errors: ResearchError[];
};
export function emptyEditorExecution(): EditorExecution {
  return {
    status: "not_run",
    modelResponse: null,
    errors: [],
  };
}
