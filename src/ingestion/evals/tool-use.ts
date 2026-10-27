import { z } from "zod";
import { check, type Check } from "./checks";

export type EvalToolCall =
  | { tool: "readPage"; url: string }
  | { tool: "searchWeb"; query: string }
  | {
      tool: "geocode";
      observation: import("../tools/geocode/tool").GeocodingObservation;
    };

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

export function checkToolUse(
  expected: z.infer<typeof toolUseExpectationSchema> | undefined,
  calls: EvalToolCall[],
) {
  if (!expected) {
    return [];
  }
  const searches = calls.flatMap((call, index) =>
    call.tool === "searchWeb" ? [index] : [],
  );
  const checks: Check[] = [];
  if (expected.minSearches !== undefined) {
    checks.push(
      check(
        "toolUse.minSearches",
        searches.length >= expected.minSearches,
        `searches >= ${expected.minSearches}`,
      ),
    );
  }
  if (expected.maxSearches !== undefined) {
    checks.push(
      check(
        "toolUse.maxSearches",
        searches.length <= expected.maxSearches,
        `searches <= ${expected.maxSearches}`,
      ),
    );
  }
  for (const { url, searchIndex } of expected.readBeforeSearch ?? []) {
    const read = calls.findIndex(
      (call) =>
        call.tool === "readPage" &&
        new URL(call.url).href === new URL(url).href,
    );
    const search = searches.at(searchIndex - 1);
    checks.push(
      check(
        `toolUse.readBeforeSearch.${searchIndex}`,
        read >= 0 && (search === undefined || read < search),
        `read ${url} before search #${searchIndex}, if needed`,
      ),
    );
  }
  return checks;
}
