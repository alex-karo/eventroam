import { refusedResearch, unavailableSources } from "../research";
import { isDeepStrictEqual as same } from "node:util";
import type { MainContext } from "./context";
import { preservedConditions } from "./context";
import { evaluate, fact } from "./facts";
import { check } from "../checks";

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
      ...refusedResearch(context.report),
      ...unavailableSources(context.report),
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
