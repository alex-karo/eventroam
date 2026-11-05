import { expect, test } from "vitest";
import { parseCatalogOptions } from "./catalog-options";

test("commands default to dry-run and retain bounded overrides", () => {
  expect(
    parseCatalogOptions([
      "refresh",
      "--event",
      "event-id",
      "--agent-steps",
      "4",
    ]),
  ).toMatchObject({
    mode: "refresh",
    dryRun: true,
    eventIds: ["event-id"],
    limits: { agentSteps: 4 },
    republish: false,
  });
  expect(
    parseCatalogOptions([
      "add",
      "--input",
      "Festival",
      "--apply",
      "--republish",
    ]),
  ).toMatchObject({ dryRun: false, republish: true });
});

test("help is available without a command", () => {
  expect(parseCatalogOptions(["--help"])).toEqual({ help: true });
});

test("refresh batches distinct targets with full/current scope", () => {
  expect(
    parseCatalogOptions([
      "refresh",
      "--event",
      "a",
      "--event",
      "b",
      "--event",
      "a",
    ]),
  ).toMatchObject({ eventIds: ["a", "b"], scope: "full" });
  expect(
    parseCatalogOptions(["refresh", "--event", "a", "--scope", "current"]),
  ).toMatchObject({ scope: "current" });
});

test("add accepts names, URLs, and full multiline notes but rejects blank or old flags", () => {
  for (const input of [
    "Festival",
    "https://organizer.test/",
    `  clue\n${"detail ".repeat(100)}\nlast line  `,
  ]) {
    expect(parseCatalogOptions(["add", "--input", input])).toMatchObject({
      input,
    });
  }
  for (const args of [
    ["add"],
    ["add", "--input", " \n"],
    ["add", "--name", "Festival"],
    ["add", "--input", "A", "--input", "B", "--apply"],
    ["add", "--input=A", "--input=B", "--apply"],
    ["refresh", "--event", "id", "--input", "clue"],
    ["refresh", "--event", "id", "--input", ""],
  ]) {
    expect(() => parseCatalogOptions(args)).toThrow();
  }
});
