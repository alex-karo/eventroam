import type { RegressionCaseDefinition } from "../../regression";
import { researchDidNotFail } from "../../research";
import { check } from "../../checks";
import { fixedHandoff, readerSelection, setField } from "./fixture";
import { emptyLinksReply } from "../empty-replies";
import { sourceReplay } from "../fixture";
import {
  soundTrailFixture,
  soundTrailSource,
  soundTrailReaderPage,
  soundTrailGeneral,
  soundTrailClassification,
} from "./sound-trail";

export const editorUncitedQualificationCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: {
    id: "editor-uncited-qualification",
    ...soundTrailFixture,
    task: "Check a ticket qualification on an uncited saved page",
    provenance: {
      kind: "synthetic-editor-source-access",
      note: "Fixed source-backed proposals cite only the homepage. A separate saved eligibility notice requires validation with native grep. Research, Reader and specialists use fixed outputs; Editor and eligible Location stay live.",
    },
    sources: [
      soundTrailSource,
      sourceReplay(
        "https://sound-trail.example/eligibility",
        "2026-10-14T12:00:00Z",
        "eligibility.md",
      ),
    ],
    roleHandoff: fixedHandoff(
      "Fixed source-backed proposals cite only the homepage. A separate saved eligibility notice requires validation with native grep. Research, Reader and specialists use fixed outputs; Editor and eligible Location stay live.",
      [
        soundTrailReaderPage,
        {
          url: "https://sound-trail.example/eligibility",
          sourceId: "s2",
          reader: readerSelection({
            overview: "Official 2027 ticket eligibility notice.",
            topics: ["tickets"],
            statedYears: ["2027"],
            limitations: [],
            evidence: [],
          }),
        },
      ],
      {
        general: soundTrailGeneral(),
        tickets: {
          currentOrNextEdition: {
            tickets: setField(
              {
                variants: [
                  {
                    label: "Three-concert pass",
                    amount: 9.99,
                    currency: "GBP",
                    terms:
                      "Public admission to three concerts of the holder’s choice.",
                    availability: "unknown",
                  },
                ],
                basePrice: null,
              },
              "The homepage lists this concert pass and price. A separate saved eligibility notice may qualify its public admission; its text is not included in these citations.",
              ["s1-e2"],
            ),
          },
          checks: [],
          unresolved: [
            {
              message:
                "Does the separately saved 2027 eligibility notice restrict the Three-concert pass? Validate before accepting the ticket block.",
              editionKey: "2027",
              field: "tickets",
            },
          ],
        },
        classification: soundTrailClassification,
        links: emptyLinksReply(),
      },
    ),
  },
  evaluate: ({ report, changes }) => [
    ...researchDidNotFail(report),
    check(
      "catalog.edition.2027.rejectRestrictedPass",
      !changes.edition(
        { key: "2027" },
        "price_details",
        (value) =>
          value?.some((offer) => offer.label === "Three-concert pass") === true,
      ),
      "Reject the ticket block qualified by the uncited eligibility notice",
    ),
  ],
};
