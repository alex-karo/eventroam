import { check } from "../../checks";
import type { RegressionEvaluator } from "../../regression";
import {
  researchStatus,
  editionSlots,
  editionByKey,
  returned,
  selectedEditionDates,
} from "../../research";

export const checks = {
  "size-historical-and-unknown": (context) => {
    const { data, changes } = context;
    const edition = editionByKey(data, "historical");
    return [
      check(
        "catalog.edition.historical.size_estimate.set.1",
        changes.edition(
          { key: "historical" },
          "size_estimate",
          (value) => value === 7500,
        ),
        "Set historical participant estimate to 7500",
      ),
      check(
        "catalog.edition.historical.size_estimate.preserve.1",
        !changes.edition(
          { key: "historical" },
          "size_estimate",
          (value) => value !== 7500 && value != null,
        ),
        "Keep historical participant estimate equal to 7500 when supplied",
      ),
      check(
        "catalog.edition.unknown.size_estimate.preserve.2",
        !changes.edition(
          { key: "unknown" },
          "size_estimate",
          (value) => value !== 6000 && value != null,
        ),
        "Keep unknown participant estimate equal to 6000 when supplied",
      ),
      check(
        "catalog.edition.unknown.size_estimate.preserve.3",
        !changes.edition(
          { key: "unknown" },
          "size_estimate",
          (value) => value === null,
        ),
        "Do not set unknown participant estimate to null",
      ),
      researchStatus(context, "success"),
      ...editionSlots(context, "historical", "unknown"),
      returned(
        "research.historical.dates",
        selectedEditionDates(context, "historical"),
        {
          startsOn: "2026-10-10",
          endsOn: "2026-10-12",
          state: "confirmed",
        },
      ),
      returned("research.historical.sizeEstimate", edition?.sizeEstimate, 7500),
      returned(
        "research.unknown.dates",
        selectedEditionDates(context, "unknown"),
        {
          startsOn: "2026-11-01",
          endsOn: "2026-11-03",
          state: "confirmed",
        },
      ),
    ];
  },
} satisfies Record<string, RegressionEvaluator>;
