import { expect, test } from "vitest";
import { writeObservation, type WriteDisposition } from "./write-observation";
import type { CatalogItemResult } from "@/catalog/write/apply-operation";

function returned(changed: boolean[]): CatalogItemResult {
  return {
    operations: changed.map((changed, index) => ({
      id: String(index),
      version: 1,
      changed,
    })),
    references: {},
    changes: [],
  };
}

test.each<{
  state: WriteDisposition;
  applied: CatalogItemResult | null;
  dryRun?: boolean;
  expected: WriteDisposition;
  count: number | null;
}>([
  {
    state: "not_attempted",
    applied: null,
    expected: "not_attempted",
    count: 0,
  },
  { state: "unknown", applied: null, expected: "unknown", count: null },
  { state: "rolled_back", applied: null, expected: "rolled_back", count: 0 },
  {
    state: "unknown",
    applied: returned([false]),
    expected: "unchanged",
    count: 0,
  },
  {
    state: "unknown",
    applied: returned([true, false, true]),
    dryRun: true,
    expected: "unchanged",
    count: 0,
  },
  {
    state: "unknown",
    applied: returned([true, false, true]),
    expected: "committed",
    count: 2,
  },
  {
    state: "committed",
    applied: returned([true]),
    expected: "committed",
    count: 1,
  },
])(
  "$state with returned result projects $expected / $count (preview $dryRun)",
  ({ state, applied, dryRun, expected, count }) => {
    expect(writeObservation({ dryRun }, applied, state)).toEqual({
      writeState: expected,
      committedOperationCount: count,
    });
  },
);
