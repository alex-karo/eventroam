import { expect, test } from "vitest";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { fixtureDependencies, runFixtureResearch } from "@/test/ingestion";
import { editorFixtureRoles } from "../../editor-fixture";
import { fixedReader } from "../../fixed-reader";
import { loadEvalSuite } from "../../fixtures";
import { checkRegressionCase } from "../../regression";

test("the Jazz check detects a bad final status after a correct General reply", async () => {
  const item = loadEvalSuite().cases.find(
    ({ id }) => id === "schedule-status-jazz-editor",
  );
  if (!item || item.location || !item.roleHandoff) {
    throw new Error("Expected the Jazz Editor fixture");
  }
  const { client } = testDatabase();
  const fx = testFixtures(client);
  const initial = item.initial.event;
  const event = fx.event({
    id: initial.id,
    slug: initial.slug,
    canonicalName: initial.canonicalName,
  });
  for (const link of initial.links ?? []) {
    fx.eventLink(event, link);
  }
  for (const edition of initial.editions) {
    fx.edition(event, {
      id: edition.id,
      editionKey: edition.editionKey,
      editionYear: edition.editionYear,
      startsOn: edition.startsOn,
      endsOn: edition.endsOn,
      dateState: edition.dateState,
      scheduleStatus: edition.scheduleStatus,
      countryCode: edition.countryCode,
    });
  }
  const report = await runFixtureResearch(item.input, {
    client,
    ...fixtureDependencies(),
    todayUtc: item.todayUtc,
    generateRoles: editorFixtureRoles(item),
    readSource: fixedReader(item),
    readPage: async (url, { budget }) => {
      budget.consumePage();
      const source = item.sources.find((source) => source.attemptedUrl === url);
      if (!source) {
        throw new Error(`Unexpected source: ${url}`);
      }
      return source;
    },
  });
  expect(
    checkRegressionCase(item, report, []).filter((check) => !check.passed),
  ).toEqual([]);

  const changed = {
    ...report,
    changes: [
      ...report.changes,
      {
        subject: initial.editions[1].id,
        field: "schedule_status",
        oldValue: "scheduled",
        newValue: "postponed",
        explanations: [],
      },
    ],
  };
  expect(checkRegressionCase(item, changed, [])).toContainEqual(
    expect.objectContaining({
      path: "catalog.2027.scheduleStatus",
      passed: false,
    }),
  );
  expect(
    checkRegressionCase(item, { ...report, editorResponse: null }, []),
  ).toContainEqual(
    expect.objectContaining({
      path: "editor.currentOrNextEdition.scheduleStatus",
      passed: false,
    }),
  );
});
