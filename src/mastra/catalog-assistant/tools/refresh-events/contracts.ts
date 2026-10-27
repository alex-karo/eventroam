import { z } from "zod";
import type { studioIngestionInputSchema } from "../../../../ingestion/workflow";

export const refreshInputSchema = z.strictObject({
  eventIds: z
    .array(z.string().trim().min(1).max(500))
    .min(1)
    .max(3)
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "Event IDs must be distinct",
    ),
  scope: z.enum(["current", "full"]).default("full"),
  dryRun: z.boolean().default(true),
});
export type RefreshRun = {
  runId: string;
  start: (options: {
    inputData: z.output<typeof studioIngestionInputSchema>;
  }) => Promise<unknown>;
  cancel: () => Promise<unknown>;
};
export type RefreshWorkflow = { createRun: () => Promise<RefreshRun> };
