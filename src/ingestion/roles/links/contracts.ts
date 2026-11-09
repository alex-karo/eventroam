import { z } from "zod";
import {
  change,
  checksSchema,
  questionsSchema,
  reasonSchema,
} from "../contracts";

const link = change(z.url().refine((value) => /^https?:\/\//.test(value)));
export const linksOutputSchema = z.strictObject({
  event: z.strictObject({
    website: link.optional(),
    socials: z.strictObject({
      instagram: link.optional(),
      facebook: link.optional(),
      youtube: link.optional(),
      tiktok: link.optional(),
      x: link.optional(),
      other: link.optional(),
    }),
  }),
  currentOrNextEdition: z.strictObject({ tickets: link.optional() }).nullable(),
  omitted: z
    .array(z.strictObject({ url: z.url(), reason: reasonSchema }))
    .max(100),
  checks: checksSchema,
  unresolved: questionsSchema,
});
export type LinksOutput = z.infer<typeof linksOutputSchema>;
