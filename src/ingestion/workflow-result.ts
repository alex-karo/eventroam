import { z } from "zod";
import { locationExecutionSchema } from "./roles/location/execution";
import { researchErrorSchema } from "./research/contracts";

export const studioIngestionResultSchema = z.strictObject({
  engineRunId: z.string(),
  ingestionRunId: z.string(),
  mode: z.enum(["add", "refresh"]),
  dryRun: z.boolean(),
  outcome: z.enum([
    "created",
    "updated",
    "published",
    "unchanged",
    "skipped",
    "failed",
  ]),
  researchStatus: z.enum(["success", "partial", "failed"]),
  editorStatus: z.enum(["success", "failed", "not_run"]),
  persistenceStatus: z.enum(["completed", "failed"]),
  eventId: z.string().nullable(),
  scope: z.enum(["full", "current"]).nullable(),
  locationStatus: locationExecutionSchema.shape.status,
  errorCodes: z.array(researchErrorSchema.shape.code),
});

export type StudioIngestionResult = z.infer<typeof studioIngestionResultSchema>;
