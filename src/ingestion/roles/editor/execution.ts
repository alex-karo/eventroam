import type { ResearchError } from "../../research/contracts";

export type EditorExecution = {
  status: "success" | "failed" | "not_run";
  modelResponse: { text: string | null; object: unknown } | null;
  /** A failed targeted review can keep the first successful reply. */
  responseStatus?: "success";
  errors: ResearchError[];
};
export function emptyEditorExecution(): EditorExecution {
  return {
    status: "not_run",
    modelResponse: null,
    errors: [],
  };
}
