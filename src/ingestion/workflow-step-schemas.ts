import { z } from "zod";
import { generalOutputSchema } from "./roles/general/contracts";
import {
  roleExecutionSchema,
  specialistResultsSchema,
} from "./specialist-results";

import { planDiagnosticsSchema } from "./stage";

const generalExecution = roleExecutionSchema(generalOutputSchema);
const [generalSuccess, generalFailure] = generalExecution.options;
const studioGeneralExecution = z.discriminatedUnion("status", [
  generalSuccess.loose(),
  generalFailure.loose(),
]);
const generalTargets = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("continue"),
    value: generalOutputSchema.options[1].extend(planDiagnosticsSchema.shape),
  }),
  z.object({
    status: z.enum(["skip", "reject"]),
    diagnostics: planDiagnosticsSchema,
  }),
]);
export const generalPhaseOutputSchema = z.union([
  z.looseObject({ execution: studioGeneralExecution, targets: generalTargets }),
  studioGeneralExecution,
  z.null(),
]);

// Preserve the branch payload for Studio. The join validates it and records errors.
export const specialistJoinInputSchema = z.union([
  z.json().describe("Retain invalid specialist results for diagnosis."),
  specialistResultsSchema,
]);
