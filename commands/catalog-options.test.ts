import { expect, test } from "vitest";
import { parseCatalogOptions } from "./catalog-options";

test("commands default to dry-run and local Studio", () => {
  expect(parseCatalogOptions(["refresh", "--event", "event-id"])).toMatchObject(
    {
      mode: "refresh",
      dryRun: true,
      eventIds: ["event-id"],
      scope: "full",
      republish: false,
      url: new URL("http://127.0.0.1:4111"),
    },
  );
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

test("Studio selects the catalog and limits and the CLI accepts only a local origin", () => {
  const command = ["refresh", "--event", "id"];
  for (const flag of [
    "--database",
    "--report",
    "--searches",
    "--agent-steps",
    "--seconds",
  ]) {
    expect(() => parseCatalogOptions([...command, flag, "5"])).toThrow();
  }
  for (const url of [
    "https://example.org",
    "http://localhost/api",
    "http://user@localhost",
    "http://localhost/?x=1",
  ]) {
    expect(() => parseCatalogOptions([...command, "--url", url])).toThrow(
      "--url",
    );
  }
});
