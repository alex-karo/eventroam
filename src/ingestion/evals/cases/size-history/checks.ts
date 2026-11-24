import { check } from "../../checks";
import type { RegressionContext } from "../../regression";
export function changedDescriptions({ item, report }: RegressionContext) {
  const changes = report.changes.filter(
    ({ subject }) => subject === item.initial.event.id,
  );
  return ["description", "short_description"].map((field) => {
    const value = changes.find((change) => change.field === field)?.newValue;
    return typeof value === "string" ? value.trim() : "";
  });
}

export function descriptionChecks(
  { report }: RegressionContext,
  texts: string[],
  expected: RegExp,
  excluded: RegExp,
) {
  const withoutEditionDetails =
    /7[, .]?500|202[56]|volunteers?|tickets?|prices?|has (included|featured|offered)|previously/i;
  return [
    check(
      "research.descriptions.content",
      texts.every(
        (text) =>
          text &&
          !/River Festival/i.test(text) &&
          !excluded.test(text) &&
          !withoutEditionDetails.test(text),
      ) && expected.test(texts.join(" ")),
      "Save two current descriptions without historical attendance or Edition details",
    ),
    check(
      "catalog.descriptions.editor",
      report.editorStatus === "success" && texts.every(Boolean),
      "Editor approves both descriptions for the catalog",
    ),
  ];
}
