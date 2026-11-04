import { z } from "zod";
import { publicationStates, scopes, linkKinds } from "./vocabulary";

type RecordValues = Record<string, unknown>;
const state = z.enum(publicationStates).default("draft");
const scope = z.enum(scopes);

export function validateEventRecord(r: RecordValues) {
  const publicationState = state.parse(r.publicationState);
  scope.nullish().parse(r.homeScope);
  if (publicationState === "published" && r.homeScope == null) {
    throw new Error("Published event needs home scope");
  }
}

export function validateLinkRecord(r: RecordValues) {
  z.enum(linkKinds).parse(r.kind);
}
export function validateAliasRecord(r: RecordValues) {
  scope.parse(r.scope);
}
