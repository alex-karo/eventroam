import { isDeepStrictEqual as same } from "node:util";
import type { MainContext } from "./context";
import { preservedConditions } from "./context";
import { check, evaluate, fact } from "./facts";

export function afroNation(context: MainContext) {
  // blocked.md: no new facts. Keep the full saved Event and require an unresolved source failure.
  return evaluate({
    required: [],
    additional: [],
    correctness: [
      fact("saved.event", same(context.original, context.event), [true]),
    ],
    conditions: [
      ...context.conditions,
      ...preservedConditions(context),
      check(
        "task.unresolved",
        context.report.unresolved.some(
          (item) => item.message.trim().length > 0,
        ),
      ),
    ],
  });
}
