import type { RegressionCaseDefinition } from "../../regression";
import type { LocationOutput } from "../../../roles/location/contracts";
import {
  researchStatus,
  editionSlots,
  returned,
  selectedEditionDates,
} from "../../research";
import { historyAndAnnouncedEditions, scopeFixture } from "../scope-fixture";

export const scopeFullHistoryCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: scopeFixture(
    "scope-full-history",
    "Check scope full history case",
    "full",
    historyAndAnnouncedEditions,
  ),
  evaluate(context) {
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
};
