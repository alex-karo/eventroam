import { expect, test } from "vitest";
import {
  validateEventRecord,
  validateLinkRecord,
  validateAliasRecord,
} from "./validation";
import { publicationStates, linkKinds } from "./vocabulary";

test("event defaults, lifecycle and home scope", () => {
  expect(() => validateEventRecord({})).not.toThrow();
  for (const publicationState of publicationStates) {
    expect(() =>
      validateEventRecord({ publicationState, homeScope: "festivals" }),
    ).not.toThrow();
  }
  for (const record of [
    { publicationState: "future" },
    { publicationState: null },
    { homeScope: "conferences" },
    { publicationState: "published" },
    { publicationState: "published", homeScope: null },
  ]) {
    expect(() => validateEventRecord(record)).toThrow();
  }
});

test("link and alias vocabularies are runtime checked", () => {
  for (const kind of linkKinds) {
    validateLinkRecord({ kind });
  }
  expect(linkKinds).toContain("x");
  expect(() => validateLinkRecord({ kind: "twitter" })).toThrow();
  validateAliasRecord({ scope: "festivals" });
  for (const value of ["future", null, undefined]) {
    expect(() => validateLinkRecord({ kind: value })).toThrow();
    expect(() => validateAliasRecord({ scope: value })).toThrow();
  }
});
