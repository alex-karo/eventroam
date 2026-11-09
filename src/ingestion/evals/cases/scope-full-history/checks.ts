import type { RegressionEvaluator } from "../../regression";
import type { LocationOutput } from "../../../roles/location/contracts";
import {
  researchStatus,
  editionSlots,
  returned,
  selectedEditionDates,
} from "../../research";

export const checks = {
  "scope-full-history": (context) => {
    const { report, item } = context;
    const location = report.locationResponse?.object as
      LocationOutput | undefined;
    const venue =
      location?.decision.status === "ready"
        ? location.decision.previousEdition?.fields.venueName
        : undefined;
    const saved = item.initial.event.editions.find(
      (edition) => edition.editionKey === "historic-weekend",
    );
    let venueName: { value: string | null | undefined } | undefined;
    if (report.locationStatus === "success" && venue) {
      if (venue.action === "keep") {
        venueName = { value: saved?.venueName };
      } else {
        venueName = { value: venue.action === "set" ? venue.value : null };
      }
    }
    return [
      researchStatus(context, "success"),
      ...editionSlots(context, "historic-weekend", "announced-weekend"),
      returned(
        "research.historic-weekend.venueName",
        venueName,
        "River Grounds",
      ),
      returned(
        "research.historic-weekend.dates",
        selectedEditionDates(context, "historic-weekend"),
        {
          startsOn: "2025-06-01",
          endsOn: "2025-06-03",
          state: "confirmed",
        },
      ),
    ];
  },
} satisfies Record<string, RegressionEvaluator>;
