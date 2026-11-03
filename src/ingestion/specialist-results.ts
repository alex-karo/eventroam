import { researchErrorSchema } from "./research/contracts";
import { z } from "zod";
import {
  ticketsOutputSchema,
  classificationOutputSchema,
  linksOutputSchema,
} from "./roles/contracts";
import { locationExecutionSchema } from "./location/execution";

function execution<T extends z.ZodType>(output: T) {
  const common = {
    modelResponse: z
      .object({ text: z.string().nullable(), object: z.unknown() })
      .nullable(),
    errors: z.array(researchErrorSchema),
    model: z.string(),
    promptVersion: z.string(),
    durationMs: z.number().nonnegative(),
  };
  return z.discriminatedUnion("status", [
    z.object({ ...common, status: z.literal("success"), output }),
    z.object({
      ...common,
      status: z.enum(["failed", "not_run"]),
      skipReason: z.string().optional(),
    }),
  ]);
}
export const specialistResultsSchema = z.object({
  tickets: execution(ticketsOutputSchema),
  classification: execution(classificationOutputSchema),
  links: execution(linksOutputSchema),
  location: locationExecutionSchema,
});

export const specialistStateSchema = specialistResultsSchema
  .omit({ location: true })
  .partial()
  .extend({
    editor: execution(z.unknown().nonoptional()).optional(),
  });
