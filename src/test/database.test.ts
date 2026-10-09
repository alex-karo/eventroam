import { expect, test } from "vitest";
import { createTestDatabase, testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";

test("each test database call starts empty in a distinct file", () => {
  const first = testDatabase();
  expect(
    first.client.prepare("SELECT count(*) FROM events").pluck().get(),
  ).toBe(0);
  testFixtures(first.client).event({ id: "first" });
  const second = createTestDatabase();
  expect(second.path).not.toBe(first.path);
  expect(
    second.client.prepare("SELECT count(*) FROM events").pluck().get(),
  ).toBe(0);
  expect(
    first.client.prepare("SELECT count(*) FROM events").pluck().get(),
  ).toBe(1);
});

test("the automatic database starts empty for another test", () => {
  const { client } = testDatabase();
  expect(client.prepare("SELECT count(*) FROM events").pluck().get()).toBe(0);
  expect(
    client
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='change_evidence'",
      )
      .get(),
  ).toBeUndefined();
});
