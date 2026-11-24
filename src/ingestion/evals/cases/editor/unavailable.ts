import type { RegressionCaseDefinition } from "../../regression";
import { refusedResearch, unavailableSources } from "../../research";
import { check } from "../../checks";
import { fixedHandoff } from "./fixture";
import { refreshInput, sourceReplay } from "../fixture";

const eventId = "event:2d90837f6b8f1217f50c";
const homePage = "https://www.glastonburyfestivals.co.uk/";

export const editorUnavailableCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: {
    id: "editor-unavailable",
    suite: "regression",
    origin: "synthetic",
    task: "Check editor unavailable",
    input: refreshInput(eventId),
    initial: {
      event: {
        id: eventId,
        slug: "glastonbury-2027-2d90837f",
        canonicalName: "Glastonbury (2027)",
        links: [
          {
            kind: "other",
            url: homePage,
            label: "Website (unverified)",
            official: false,
          },
        ],
        editions: [
          {
            id: "edition:2d90837f6b8f1217f50c",
            editionKey: "source-row",
            editionYear: 2027,
            startsOn: "2027-06-23",
            endsOn: "2027-06-27",
            dateState: "confirmed",
            scheduleStatus: "scheduled",
            countryCode: "GB",
            termIds: [],
          },
        ],
      },
    },
    sources: [
      sourceReplay(homePage, "2026-10-03T16:33:58.662Z", "unavailable.md", {
        status: "failed",
        reasonCode: "Injected source unavailable",
      }),
    ],
    provenance: {
      kind: "captured-source-editor-regression",
      note: "Reuses captured pages with controlled saved catalog state. Unavailable injects retrieval failure; clear truncates captured contact text to its office section. Editor input now uses fixed source-backed Reader passages and explicit proposal citations. Research and Reader do not call a model.",
    },
    roleHandoff: fixedHandoff(
      "Captured editor-unavailable research from openspec/changes/ingestion-editor/evaluation/final-full-rerun.json; openai/gpt-6-luna, editor-findings-v1; 2026-10-11T23:36:14.179Z; classification migrated to editor-findings-v2 complete-list contract. Adapted to fixed domain roles. Fixed Reader passages are copied from source-backed artifacts from the standard-tier 2026-11-02 run. Captures: . Collection reads only the fixed pages. Captured proposals have explicit citations and retain their unchecked findings; they make no new claim of complete research. No model is called for Research, Reader or the captured specialists. Editor and eligible Location still run. Page-coverage lists are empty because these fixed inputs test Editor, not Research navigation.",
      [{ url: homePage, sourceId: "s1" }],
      {},
    ),
  },
  evaluate: (context) => {
    const { report } = context;
    return [
      ...refusedResearch(report),
      ...unavailableSources(report),
      check(
        "editor.status",
        report.editorStatus === "not_run",
        "Stop before Editor when sources are unavailable",
      ),
    ];
  },
};
