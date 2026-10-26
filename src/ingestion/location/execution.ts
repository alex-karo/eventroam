import { z } from "zod";
import { geocodingObservationSchema } from "../tools/geocode/contracts";
import { registeredPointSchema } from "./contracts";
import { materializedLocationSchema } from "./validate";

export const locationExecutionSchema = z.strictObject({
  status: z.enum(["success", "rejected", "failed", "not_run"]),
  modelResponse: z
    .strictObject({ text: z.string().nullable(), object: z.unknown() })
    .nullable(),
  observations: z.array(geocodingObservationSchema),
  points: z.array(registeredPointSchema),
  materialized: materializedLocationSchema.nullable(),
  errors: z.array(
    z.strictObject({
      code: z.enum(["location_rejected", "location_failed", "limit_reached"]),
      stage: z.literal("location"),
      message: z.string(),
    }),
  ),
});
export type LocationExecution = z.infer<typeof locationExecutionSchema>;
export const emptyLocationExecution = (): LocationExecution => ({
  status: "not_run",
  modelResponse: null,
  observations: [],
  points: [],
  materialized: null,
  errors: [],
});
