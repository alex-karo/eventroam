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
      "--name",
      "Festival",
      "--apply",
      "--republish",
    ]),
  ).toMatchObject({ dryRun: false, republish: true });
});

test("ambiguous commands fail before opening the database or calling a model", () => {
  for (const args of [
    ["check", "--event", "id", "--pages", "4"],
    ["check", "--event", "id", "--model-calls", "4"],
    ["check"],
    ["refresh"],
    ["check", "--edition", "edition-id"],
    ["add", "--name", "Test", "--event", "id"],
    ["check", "--event", "id", "--apply", "--dry-run"],
    ["check", "--event", "id", "--agent-steps", "-1"],
    ["add", "--name", "Test", "--url", "https://example.org"],
  ]) {
    expect(() => parseCatalogOptions(args)).toThrow();
  }
  expect(() =>
    parseCatalogOptions(["add", "--name", "Test", "--owner", "Owner"]),
  ).toThrow();
  expect(parseCatalogOptions(["--help"])).toEqual({ help: true });
});

test("refresh batches distinct targets with full/current scope and rejects removed modes", () => {
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
  for (const args of [
    ["check", "--event", "a"],
    ["refresh", "--event", "a", "--scope", "next"],
    ["add", "--name", "Fest", "--scope", "full"],
  ]) {
    expect(() => parseCatalogOptions(args)).toThrow();
  }
});
