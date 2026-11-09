import { bindSelectedEvidence } from "../../evidence/contracts";
import { segmentPage } from "../../evidence/segments";
import { invokeRole, type RoleExecution } from "../invoke";
import { validateSchema } from "../validation";
import { PROMPT_VERSIONS } from "../versions";
import { readerSelectionSchema, type ReaderSelectionOutput } from "./contracts";
import { readerInstructions } from "./prompt";

type ReaderOptions = Omit<
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
};

type BoundEvidence = ReturnType<typeof bindSelectedEvidence>;
type ReaderExecution<T> = RoleExecution<T> & { bound: BoundEvidence | null };
export type ReadSource = (
  options: ReaderOptions,
) => Promise<ReaderExecution<Omit<ReaderSelectionOutput, "evidence">>>;

const oversized =
  "Whole page exceeds Reader input limit; no page portion was processed";

function readerInputLimit(limits: ReaderOptions["inputLimits"]) {
  return limits
    ? limits.pageInputCharacters - limits.inputReserveCharacters
    : Infinity;
}

function skippedReader(
  model: string,
  skipReason: string,
): ReaderExecution<never> {
  return {
    status: "not_run",
    modelResponse: null,
    errors: [],
    model,
    promptVersion: PROMPT_VERSIONS.reader,
    durationMs: 0,
    skipReason,
    bound: null,
  };
}

export async function invokeReader<T>(
  options: ReaderOptions &
    Pick<Parameters<typeof invokeRole<T>>[0], "schema" | "validateReply">,
  bind: (output: T) => BoundEvidence,
): Promise<ReaderExecution<T>> {
  const limit = readerInputLimit(options.inputLimits);
  if (
    options.input.page.length > limit ||
    JSON.stringify(options.input).length > limit
  ) {
    return skippedReader(options.config.model, oversized);
  }
  if (options.reserveCall?.() === false) {
    return skippedReader(
      options.config.model,
      "The Reader call limit or run deadline left the whole page unprocessed",
    );
  }
  const execution = await invokeRole({
    ...options,
    config: { ...options.config, reasoningEffort: "medium" },
    role: "reader",
    version: PROMPT_VERSIONS.reader,
    instructions: readerInstructions,
    cacheInstructions: true,
  });
  return {
    ...execution,
    bound: execution.output ? bind(execution.output) : null,
  };
}

export async function readSource(options: ReaderOptions) {
  const { source, page } = options.input;
  if (page.length > readerInputLimit(options.inputLimits)) {
    return skippedReader(options.config.model, oversized);
  }
  const { numbered, spans } = segmentPage(page);
  return invokeReader(
    {
      ...options,
      input: { ...options.input, page: numbered },
      schema: readerSelectionSchema,
      validateReply: (reply) =>
        validateSchema(
          readerSelectionSchema,
          reply,
          "reader",
          "Fix the listed fields. Return a complete result for the same numbered page. Keep each valid segment selection with its topics and context.",
        ),
    },
    (output) =>
      bindSelectedEvidence(source.id, page, output, source.finalUrl, spans),
  );
}
