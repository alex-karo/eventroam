import { expect, test } from "vitest";
import { createTestDatabase, testDatabase } from "./database";

test("each test database call starts empty in a distinct file", () => {
  const first = testDatabase();
  expect(
    first.client.prepare("SELECT count(*) FROM sources").pluck().get(),
  ).toBe(0);
  first.client
    .prepare(
      "INSERT INTO sources (id,canonical_url,kind,authority,created_at,updated_at) VALUES ('first','https://example.org/','website','official','2026-10-01T00:00:00Z','2026-10-01T00:00:00Z')",
    )
    .run();
  const second = createTestDatabase();
  expect(second.path).not.toBe(first.path);
  expect(
    second.client.prepare("SELECT count(*) FROM sources").pluck().get(),
  ).toBe(0);
  expect(
    first.client.prepare("SELECT count(*) FROM sources").pluck().get(),
  ).toBe(1);
});

test("the automatic database starts empty for another test", () => {
  const { client } = testDatabase();
  expect(client.prepare("SELECT count(*) FROM sources").pluck().get()).toBe(0);
  expect(
    client
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='change_evidence'",
      )
      .get(),
  ).toBeUndefined();
});
