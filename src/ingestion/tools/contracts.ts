import { z } from "zod";

export const sourceUrlSchema = z
  .url({ protocol: /^https?$/ })
  .regex(/^https?:\/\//)
  .describe(
    "An absolute HTTP/HTTPS URL of a public page, without credentials. Private addresses and unsafe redirects are blocked.",
  );

export const remainingSchema = z.object({
  searches: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
});

export type KnownSourceLink = {
  url: string;
  owner: "event" | "edition";
  kind: string;
  official: boolean;
  editionKey?: string;
};
