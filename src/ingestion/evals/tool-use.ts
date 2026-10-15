import { z } from "zod";

export type EvalToolCall =
  { tool: "readPage"; url: string } | { tool: "searchWeb"; query: string };

export const toolUseExpectationSchema = z.object({
  minSearches: z.number().int().nonnegative().optional(),
  maxSearches: z.number().int().nonnegative().optional(),
  readBeforeSearch: z
    .array(
      z.object({
        url: z.url(),
        searchIndex: z.number().int().positive(),
      }),
    )
    .optional(),
});

export function scoreToolUse(
  expected: z.infer<typeof toolUseExpectationSchema> | undefined,
  calls: EvalToolCall[],
) {
  if (!expected) {
    return null;
  }
  const searches = calls.flatMap((call, index) =>
    call.tool === "searchWeb" ? [index] : [],
  );
  const checks: { description: string; matched: boolean }[] = [];
  if (expected.minSearches !== undefined) {
    checks.push({
      description: `searches >= ${expected.minSearches}`,
      matched: searches.length >= expected.minSearches,
    });
  }
  if (expected.maxSearches !== undefined) {
    checks.push({
      description: `searches <= ${expected.maxSearches}`,
      matched: searches.length <= expected.maxSearches,
    });
  }
  for (const { url, searchIndex } of expected.readBeforeSearch ?? []) {
    const read = calls.findIndex(
      (call) =>
        call.tool === "readPage" &&
        new URL(call.url).href === new URL(url).href,
    );
    const search = searches.at(searchIndex - 1);
    checks.push({
      description: `read ${url} before search #${searchIndex}, if needed`,
      matched: read >= 0 && (search === undefined || read < search),
    });
  }
  return {
    score: checks.length
      ? checks.filter((check) => check.matched).length / checks.length
      : 1,
    checks,
  };
}
