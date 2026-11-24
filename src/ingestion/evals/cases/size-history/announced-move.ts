import { check } from "../../checks";
import type { RegressionCaseDefinition } from "../../regression";
import { changedDescriptions, descriptionChecks } from "./checks";
import { programmeEvidence, sizeHistoryFixture } from "./fixture";

export const descriptionAnnouncedMoveCase: RegressionCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: sizeHistoryFixture(
    {
      id: "description-announced-move",
      task: "Use the announced urban format before the next festival",
      note: "A fixed official announcement permanently changes the festival setting before the next programme. The historical forest format and the temporary jazz stage must not leak into the current descriptions.",
    },
    "announced-move.md",
    {
      coverage: {
        found: [
          "City Square festival venue in River Town, Portugal",
          "Previous and next programme dates",
          "Festival format and activities",
          "Historical participant estimate",
        ],
        notPublished: [
          "No ticket categories, prices or ticket shop are published",
        ],
      },
      evidence: [
        ...programmeEvidence,
        {
          quote: 6,
          topics: ["classification", "description", "location"],
        },
        {
          quote: 7,
          topics: ["dates", "tickets", "links"],
        },
      ],
    },
    {
      description:
        "River Festival brings dancing and workshops to a forest campsite.",
      shortDescription:
        "River Festival is an outdoor music festival in the forest.",
    },
  ),
  evaluate(context) {
    const texts = changedDescriptions(context);
    const urban = /urban|city|square/i;
    return [
      ...descriptionChecks(context, texts, urban, /forest|camping|jazz/i),
      check(
        "research.descriptions.announcedMove",
        texts.every((text) => urban.test(text)),
        "Both descriptions use the announced urban setting",
      ),
    ];
  },
};
