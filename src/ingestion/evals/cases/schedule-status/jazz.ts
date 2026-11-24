import type { ReaderSelectionOutput } from "../../../roles/reader/contracts";
import { check, contains } from "../../checks";
import type { RegressionPipelineCaseFile } from "../../fixtures";
import type {
  RegressionCaseDefinition,
  RegressionContext,
} from "../../regression";
import { editionSlots } from "../../research";
import { searchCount } from "../../tool-use";
import { emptyLinksReply, emptyTicketsReply } from "../empty-replies";
import { refreshInput, sourceReplay } from "../fixture";
import { checkScheduledEditions } from "./checks";

const eventId = "event:20854faa5bc92fc3dc3a";
const eventName = "Jazz in the Park";

const sharedFixture = {
  suite: "regression",
  origin: "captured",
  todayUtc: "2026-11-14",
  input: refreshInput(eventId, "full"),
} as const;

function jazzProvenance(...editorNotes: string[]) {
  return {
    kind: "captured-schedule-status-regression",
    note: [
      "Source excerpts keep the original text from the production audit of 2026-11-14. Navigation and unrelated text are omitted. Saved catalog state and fixed Reader selections isolate schedule status. No live source fallback.",
      ...editorNotes,
      "Both source URLs are saved links so Research can inspect the excerpts without search. The 2026 excerpt includes its programme heading and closure statement from the same captured page (original lines 232, 234, 272-277, 361 and 427).",
    ].join(" "),
  };
}

function jazzReader({
  overview,
  found,
  statedYears,
  quote,
}: {
  overview: string;
  found: string[];
  statedYears: string[];
  quote: { start: number; end: number };
}): ReaderSelectionOutput {
  const topics: ReaderSelectionOutput["topics"] = [
    "identity",
    "dates",
    "status",
  ];
  return {
    overview,
    coverage: { found, notPublished: [] },
    topics,
    statedYears,
    limitations: [],
    evidence: [{ quote, topics }],
  };
}

type JazzEdition = {
  editionKey: string;
  sourceId: string;
  page: ReturnType<typeof sourceReplay>;
  reader: ReaderSelectionOutput;
  editorOverview?: string;
};

const jazz2027: JazzEdition = {
  editionKey: "2027",
  sourceId: "s1",
  page: sourceReplay(
    "https://bilete.jazzinthepark.ro/",
    "2026-11-13T03:25:11.753Z",
    "jazz-2027.md",
  ),
  reader: jazzReader({
    overview:
      "The Jazz in the Park ticket page gives the full 25–27 June 2027 programme dates and includes EventRescheduled metadata.",
    found: ["Complete 2027 festival programme date range"],
    statedYears: ["2027"],
    quote: { start: 1, end: 9 },
  }),
  editorOverview:
    "Jazz in the Park 2027 ticket page with dates and EventRescheduled metadata.",
};
const jazz2026: JazzEdition = {
  editionKey: "2026",
  sourceId: "s2",
  page: sourceReplay(
    "https://www.iabilet.ro/bilete-jazz-in-the-park-2026-112018/",
    "2026-11-13T03:27:52.807Z",
    "jazz-2026.md",
  ),
  reader: jazzReader({
    overview:
      "The Jazz in the Park 2026 page identifies its programme dates, says the event ended, and links to 2027 tickets.",
    found: ["Complete 2026 programme date range", "2026 festival ended"],
    statedYears: ["2026", "2027"],
    quote: { start: 1, end: 8 },
  }),
};
const jazzEditions = [jazz2027, jazz2026];

function initialJazz(
  scheduleStatus: "scheduled" | "postponed",
): RegressionPipelineCaseFile["initial"] {
  const edition = {
    dateState: "confirmed" as const,
    scheduleStatus,
    countryCode: "RO",
    termIds: ["validation:festival", "validation:music"],
  };
  return {
    event: {
      id: eventId,
      slug: "jazz-in-the-park",
      canonicalName: eventName,
      links: [
        {
          kind: "official_site",
          url: jazz2027.page.attemptedUrl,
          official: true,
        },
        { kind: "other", url: jazz2026.page.attemptedUrl, official: true },
      ],
      editions: [
        {
          id: "edition:20854faa5bc92fc3dc3a",
          editionKey: jazz2026.editionKey,
          editionYear: 2026,
          startsOn: "2026-06-05",
          endsOn: "2026-06-07",
          ...edition,
        },
        {
          id: "8ed1a089-8cc1-4ac5-bb77-c6ecde56889e",
          editionKey: jazz2027.editionKey,
          editionYear: 2027,
          startsOn: "2027-06-25",
          endsOn: "2027-06-27",
          ...edition,
        },
      ],
    },
  };
}

function firstEvidenceId({ sourceId }: JazzEdition) {
  return `${sourceId}-e1`;
}

function scheduledEditionProposal(edition: JazzEdition) {
  const evidenceId = firstEvidenceId(edition);
  return {
    editionKey: edition.editionKey,
    reason: "The source supports this Edition and its programme dates.",
    evidenceIds: [evidenceId],
    fields: {
      scheduleStatus: {
        action: "set" as const,
        value: "scheduled" as const,
        reason:
          "The source gives the current programme dates. EventRescheduled records a move, not an unknown replacement range.",
        evidenceIds: [evidenceId],
      },
    },
  };
}

const editorCoverage = {
  found: ["Festival dates and schedule status"],
  notPublished: [],
};

const jazzEditorHandoff: NonNullable<
  RegressionPipelineCaseFile["roleHandoff"]
> = {
  schemaVersion: 7,
  provenance:
    "Controlled proposals based on Jazz in the Park sources from run 29609b38-ed57-4bd9-a544-c69ac8e637c1. The first General reply used scheduled for both Editions; Editor then changed both to postponed. These fixed proposals test that failure with original source excerpts. Reader and specialist replies are fixed; Editor still runs.",
  pages: jazzEditions.map(({ page, sourceId, reader, editorOverview }) => ({
    url: page.attemptedUrl,
    sourceId,
    reader: {
      ...reader,
      overview: editorOverview ?? reader.overview,
      coverage: editorCoverage,
    },
  })),
  collection: { checks: [], unresolved: [] },
  roles: {
    general: {
      decision: "targets",
      eventId,
      observedEventName: eventName,
      reason: "The ticket pages identify the saved festival.",
      evidenceIds: jazzEditions.map(firstEvidenceId),
      previousEdition: scheduledEditionProposal(jazz2026),
      currentOrNextEdition: scheduledEditionProposal(jazz2027),
      checks: [],
      unresolved: [],
    },
    tickets: emptyTicketsReply(),
    classification: {
      previousEdition: {},
      currentOrNextEdition: {},
      checks: [],
      unresolved: [],
    },
    links: emptyLinksReply(),
  },
};

function checkJazzSchedule(context: RegressionContext) {
  return [
    ...editionSlots(context, "2026", "2027"),
    ...checkScheduledEditions(context, ["2026", "2027"]),
  ];
}

export const jazzPipelineCase: RegressionCaseDefinition = {
  fixture: {
    ...sharedFixture,
    id: "schedule-status-jazz",
    task: "Check schedule status for Jazz in the Park",
    provenance: jazzProvenance(),
    initial: initialJazz("postponed"),
    sources: jazzEditions.map(({ page, reader }) => ({
      ...page,
      readerOutput: reader,
    })),
  },
  evaluate(context) {
    return [
      ...checkJazzSchedule(context),
      check(
        "toolUse.maxSearches",
        searchCount(context.calls) === 0,
        "Use zero searches when known pages cover both programmes",
      ),
    ];
  },
  moduleUrl: import.meta.url,
};

export const jazzEditorCase: RegressionCaseDefinition = {
  fixture: {
    ...sharedFixture,
    id: "schedule-status-jazz-editor",
    task: "Check Editor review of current dates with EventRescheduled metadata",
    provenance: jazzProvenance(
      "Fixed General proposals keep scheduled, as in the first General reply from the audited run. Editor must assess the proposals with the source metadata.",
    ),
    initial: initialJazz("scheduled"),
    sources: jazzEditions.map(({ page }) => page),
    roleHandoff: jazzEditorHandoff,
  },
  evaluate(context) {
    return [
      ...checkJazzSchedule(context),
      ...["previousEdition", "currentOrNextEdition"].map((slot) =>
        check(
          `editor.${slot}.scheduleStatus`,
          contains(context.report.editorResponse?.object, {
            decisions: {
              path: `${slot}.fields.scheduleStatus`,
              decision: "approve",
            },
          }),
          "Approve scheduled with the supported current dates",
        ),
      ),
    ];
  },
  moduleUrl: import.meta.url,
};
