import { bindEvidence } from "../../evidence/contracts";
import { invokeRole } from "../invoke";
import { PROMPT_VERSIONS } from "../versions";
import { readerOutputSchema } from "./contracts";
import { readerInstructions } from "./prompt";
import { validateReaderReply } from "./validate";

export async function readSource(
  options: Omit<
    Parameters<typeof invokeRole>[0],
    | "role"
    | "version"
    | "instructions"
    | "schema"
    | "cacheInstructions"
    | "validateReply"
    | "input"
  > & {
    input: {
      assignment: unknown;
      source: { id: string; finalUrl: string; markdown?: undefined };
      page: string;
    };
  },
) {
  const execution = await invokeRole({
    ...options,
    config: { ...options.config, reasoningEffort: "medium" },
    role: "reader",
    version: PROMPT_VERSIONS.reader,
    instructions: readerInstructions,
    cacheInstructions: true,
    schema: readerOutputSchema,
    validateReply: validateReaderReply,
  });
  if (execution.status !== "success" || !execution.output) {
    return { ...execution, bound: null };
  }
  const { source, page } = options.input;
  return {
    ...execution,
    output: execution.output,
    bound: bindEvidence(source.id, page, execution.output, source.finalUrl),
  };
}
