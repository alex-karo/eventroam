import { check } from "../../checks";
import type { RegressionEvaluator } from "../../regression";
import {
  researchDidNotFail,
  editionSlots,
  editionByKey,
  returned,
  selectedEditionDates,
} from "../../research";

export const checks = {
  "size-evidence": (context) => {
    const { data, changes } = context;
    const edition = editionByKey(data, "participants");
    return [
      check(
        "catalog.edition.participants.size_estimate.set.1",
        changes.edition(
          { key: "participants" },
          "size_estimate",
          (value) => value === 8000,
        ),
        "Set participants participant estimate to 8000",
      ),
      check(
        "catalog.edition.participants.size_estimate.preserve.1",
        !changes.edition(
          { key: "participants" },
          "size_estimate",
          (value) => value !== 8000 && value != null,
        ),
        "Keep participants participant estimate equal to 8000 when supplied",
      ),
      check(
        "catalog.edition.repeat-admissions.size_estimate.preserve.2",
        !changes.edition(
          { key: "repeat-admissions" },
          "size_estimate",
          (value) => value !== 6000 && value != null,
        ),
        "Keep repeat-admissions participant estimate equal to 6000 when supplied",
      ),
      check(
        "catalog.edition.repeat-admissions.size_estimate.preserve.3",
        !changes.edition(
          { key: "repeat-admissions" },
          "size_estimate",
          (value) => value === null,
        ),
        "Do not set repeat-admissions participant estimate to null",
      ),
      ...researchDidNotFail(context.report),
      ...editionSlots(context, "repeat-admissions", "participants"),
      returned(
        "research.participants.dates",
        selectedEditionDates(context, "participants"),
        {
          startsOn: "2026-10-01",
          endsOn: "2026-10-03",
          state: "confirmed",
        },
      ),
      returned(
        "research.participants.sizeEstimate",
        edition?.sizeEstimate,
        8000,
      ),
      returned(
        "research.repeat-admissions.dates",
        selectedEditionDates(context, "repeat-admissions"),
        {
          startsOn: "2026-09-20",
          endsOn: "2026-09-22",
          state: "confirmed",
        },
      ),
    ];
  },
} satisfies Record<string, RegressionEvaluator>;
