import type { RegressionCaseDefinition } from "../../regression";
import { refusedResearch } from "../../research";
import { check } from "../../checks";
import { refreshInput, sourceReplay } from "../fixture";

export const currentIdentityContradictionCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: {
    id: "current-identity-contradiction",
    suite: "regression",
    origin: "synthetic",
    task: "Check narrow current identity conflict",
    todayUtc: "2026-10-14",
    provenance: {
      kind: "synthetic-source-regression",
      note: "Fictional sources isolate observed failure patterns; not captured website content. No live website/search fallback.",
    },
    input: refreshInput("source-homonym-wrong-saved-website", "current"),
    initial: {
      event: {
        id: "source-homonym-wrong-saved-website",
        slug: "source-homonym-wrong-saved-website",
        canonicalName: "Harbor Echo",
        links: [
          {
            kind: "official_site",
            url: "https://harbor-echo-australia.example/",
            official: true,
          },
        ],
        editions: [
          {
            id: "source-homonym-wrong-saved-website-edition",
            editionKey: "2027",
            editionYear: 2027,
            startsOn: "2027-01-23",
            endsOn: "2027-01-30",
            dateState: "confirmed",
            scheduleStatus: "scheduled",
            countryCode: "GB",
            termIds: [],
            locality: "Castlewellan",
            venueName: "Castlewellan Grounds",
          },
        ],
      },
    },
    sources: [
      sourceReplay(
        "https://harbor-echo-australia.example/",
        "2026-10-14T12:00:00Z",
        "../source-regressions/homonym.md",
      ),
    ],
  },
  evaluate(context) {
    const { report } = context;
    return [
      ...refusedResearch(report, "partial"),
      check(
        "research.editorStatus",
        report.editorStatus === "not_run",
        "Expected identity conflict to skip editing",
      ),
      check(
        "research.sources.available",
        report.sources.some((source) => source.outcome === "ok"),
        "Expected identity conflict evidence from an available source",
      ),
      check(
        "research.identity",
        report.unresolved.some(
          (question) =>
            question.field === "identity" && /full/i.test(question.message),
        ),
        "Expected an unresolved identity question directing a full refresh",
      ),
    ];
  },
};
