import { check } from "../../checks";
import type { RegressionCaseDefinition } from "../../regression";
import {
  researchDidNotFail,
  editionSlots,
  editionByKey,
  returned,
  selectedEditionDates,
} from "../../research";
import { refreshInput, sourceReplay } from "../fixture";

export const sizeEvidenceCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: {
    id: "size-evidence",
    suite: "regression",
    origin: "synthetic",
    task: "Check size evidence case",
    input: refreshInput("size-event", "full"),
    provenance: {
      kind: "synthetic-size-regression",
      note: "Checks participant estimates against venue capacity and repeated admissions. No live HTTP or search fallback.",
    },
    initial: {
      event: {
        id: "size-event",
        slug: "size-evidence",
        canonicalName: "River Festival",
        links: [
          {
            kind: "official_site",
            url: "https://size-fixture.example/festival",
            official: true,
          },
        ],
        editions: [
          {
            id: "size-participants",
            editionKey: "participants",
            editionYear: 2026,
            startsOn: "2026-10-01",
            endsOn: "2026-10-03",
            dateState: "confirmed",
            scheduleStatus: "scheduled",
            countryCode: "PT",
            venueName: "River Grounds",
            termIds: [
              "validation:festival",
              "validation:openair",
              "validation:music",
            ],
            sizeEstimate: null,
          },
          {
            id: "size-repeat-admissions",
            editionKey: "repeat-admissions",
            editionYear: 2026,
            startsOn: "2026-09-20",
            endsOn: "2026-09-22",
            dateState: "confirmed",
            scheduleStatus: "scheduled",
            countryCode: "PT",
            venueName: "River Grounds",
            termIds: [
              "validation:festival",
              "validation:openair",
              "validation:music",
            ],
            sizeEstimate: 6000,
          },
        ],
      },
    },
    sources: [
      sourceReplay(
        "https://size-fixture.example/festival",
        "2026-10-03T12:00:00Z",
        "page.md",
      ),
    ],
    todayUtc: "2026-09-23",
  },
  evaluate(context) {
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
};
