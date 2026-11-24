import type { MainPipelineCaseFile, PipelineEvalCase } from "./fixtures";
import { findCaseDefinition } from "./cases/suite";
import type { CatalogResearchResult } from "../contracts";
import { mainContext, type Catalog, type MainContext } from "./main/context";
import { evaluate, fact } from "./main/facts";
import {
  assessDescriptionFormat,
  minimumDescriptionFormat,
} from "./description-format";

export type MainScore = ReturnType<typeof evaluate>;
export type MainCaseDefinition = {
  fixture: MainPipelineCaseFile;
  moduleUrl: string;
  evaluate: (context: MainContext) => Parameters<typeof evaluate>[0];
  descriptionReference: string;
};

export async function evaluateMainCase(
  item: PipelineEvalCase,
  before: Catalog,
  after: Catalog,
  report: CatalogResearchResult,
) {
  const definition = findCaseDefinition(item.id);
  if (!definition || !("descriptionReference" in definition)) {
    throw new Error(
      `Main case needs a registered pipeline evaluator: ${item.id}`,
    );
  }
  const context = mainContext(item, before, after, report);
  const descriptionFormat = await assessDescriptionFormat(
    definition.descriptionReference,
    context.event,
  );
  const checks = definition.evaluate(context);
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
