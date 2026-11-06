import type { PipelineEvalCase } from "./fixtures";
import type { CatalogResearchResult } from "../contracts";
import { mainContext, type Catalog } from "./main/context";
import { roskilde } from "./main/roskilde";
import { wacken } from "./main/wacken";
import { sziget } from "./main/sziget";
import { glastonbury } from "./main/glastonbury";
import { afroNation } from "./main/afro-nation";
import { evaluate, fact } from "./main/facts";
import {
  assessDescriptionFormat,
  minimumDescriptionFormat,
} from "./description-format";

const evaluators = {
  roskilde,
  wacken,
  sziget,
  glastonbury,
  "afro-nation-portugal-blocked": afroNation,
};
export type MainScore = ReturnType<typeof evaluate>;

const descriptionReferences = new Map<string, string>([
  // glastonbury/areas.md lists music stages, theatre, and circus.
  [
    "glastonbury",
    "A music and performing arts festival with many stages and areas.",
  ],
  // roskilde/about.md describes the concerts and communal camping.
  ["roskilde", "A music festival with concerts and a large camping community."],
  // sziget/experience.md describes the varied music and arts programme.
  [
    "sziget",
    "A large music and arts festival with a varied programme across multiple venues.",
  ],
  // wacken/page.md describes an open-air festival for heavy metal fans.
  ["wacken", "An open-air music festival centred on heavy metal and its fans."],
]);

export function assertMainCase(item: PipelineEvalCase) {
  if (
    !Object.hasOwn(evaluators, item.id) ||
    item.location ||
    item.roleHandoff
  ) {
    throw new Error(
      `Main case needs a registered pipeline evaluator: ${item.id}`,
    );
  }
}

export async function evaluateMainCase(
  item: PipelineEvalCase,
  before: Catalog,
  after: Catalog,
  report: CatalogResearchResult,
) {
  const context = mainContext(item, before, after, report);
  const descriptionFormat = await assessDescriptionFormat(
    descriptionReferences.get(item.id),
    context.event,
  );
  const checks = evaluators[item.id as keyof typeof evaluators](context);
  const formatFacts = Object.entries(descriptionFormat.fields).flatMap(
    ([field, probability]) => {
      if (typeof probability !== "number") {
        return [];
      }
      const accepted = probability >= minimumDescriptionFormat;
      return [
        {
          ...fact(`event.${field}.format`, accepted ? true : undefined, [true]),
          note: `Decider probability ${probability}. Required minimum is ${minimumDescriptionFormat}.`,
        },
      ];
    },
  );
  return {
    quality: evaluate({
      ...checks,
      required: [...checks.required, ...formatFacts],
    }),
    descriptionFormat,
  };
}
