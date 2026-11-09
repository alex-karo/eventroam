import { bindEvidence, bindSelectedEvidence } from "../../evidence/contracts";
import { segmentPage } from "../../evidence/segments";
import { invokeRole, type RoleExecution } from "../invoke";
import { PROMPT_VERSIONS } from "../versions";
import {
  readerOutputSchema,
  readerSelectionSchema,
  type ReaderOutput,
  type ReaderSelectionOutput,
} from "./contracts";
import { readerInstructions } from "./prompt";
import { validateReaderReply, validateReaderSelection } from "./validate";

type ReaderExecution = RoleExecution<ReaderOutput | ReaderSelectionOutput> & {
  bound: ReturnType<typeof bindEvidence> | null;
};

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
    inputLimits?: {
      pageInputCharacters: number;
      inputReserveCharacters: number;
    };
    reserveCall?: () => boolean;
  },
): Promise<ReaderExecution> {
  const { source, page } = options.input;
  const version = PROMPT_VERSIONS.reader;
  const skipped = (skipReason: string): ReaderExecution => ({
    status: "not_run",
    modelResponse: null,
    errors: [],
    model: options.config.model,
    promptVersion: version,
    durationMs: 0,
    skipReason,
    bound: null,
  });
  const oversized =
    "Whole page exceeds Reader input limit; no page portion was processed";
  const limit = options.inputLimits
    ? options.inputLimits.pageInputCharacters -
      options.inputLimits.inputReserveCharacters
    : Infinity;
  if (page.length > limit) {
    return skipped(oversized);
  }

  // Injected generators replay the literal format used by saved eval fixtures.
  const segments = options.generate ? null : segmentPage(page);
  const input = { ...options.input, page: segments?.numbered ?? page };
  if (JSON.stringify(input).length > limit) {
    return skipped(oversized);
  }
  if (options.reserveCall?.() === false) {
    return skipped(
      "The Reader call limit or run deadline left the whole page unprocessed",
    );
  }

  const invocation = {
    ...options,
    input,
    config: { ...options.config, reasoningEffort: "medium" as const },
    role: "reader" as const,
    version,
    instructions: readerInstructions,
    cacheInstructions: true,
  };
  if (!segments) {
    const execution = await invokeRole({
      ...invocation,
      schema: readerOutputSchema,
      validateReply: validateReaderReply,
    });
    return {
      ...execution,
      bound: execution.output
        ? bindEvidence(source.id, page, execution.output, source.finalUrl)
        : null,
    };
  }

  const execution = await invokeRole({
    ...invocation,
    schema: readerSelectionSchema,
    validateReply: validateReaderSelection,
  });
  return {
    ...execution,
    bound: execution.output
      ? bindSelectedEvidence(
          source.id,
          page,
          execution.output,
          source.finalUrl,
          segments.spans,
        )
      : null,
  };
}
