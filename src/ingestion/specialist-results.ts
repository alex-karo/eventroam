import type { CatalogResearchInput } from "./contracts";
import { assignedGroups } from "./groups";
import { researchErrorSchema, type ResearchError } from "./research/contracts";
import type { Targets } from "./roles/general/contracts";
import { z } from "zod";
import { ticketsOutputSchema } from "./roles/tickets/contracts";
import { classificationOutputSchema } from "./roles/classification/contracts";
import { linksOutputSchema } from "./roles/links/contracts";
import { locationExecutionSchema } from "./roles/location/execution";

export const specialistRoles = [
  "tickets",
  "classification",
  "location",
  "links",
] as const;
export type SpecialistRole = (typeof specialistRoles)[number];

export function assignedSpecialists(
  scope: CatalogResearchInput["scope"],
  targets: Pick<Targets, "previousEdition" | "currentOrNextEdition">,
) {
  const groups = assignedGroups(scope, targets);
  return specialistRoles.filter((role) =>
    groups.some(({ owner }) => owner === role),
  );
}

function execution<T extends z.ZodType>(output: T) {
  const common = {
    modelResponse: z
      .object({ text: z.string().nullable(), object: z.unknown() })
      .nullable(),
    responseFailed: z.literal(true).optional(),
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
  .partial();

const fatalErrorCodes = new Set<ResearchError["code"]>([
  "model_failed",
  "limit_reached",
  "country_conflict",
  "workflow_failed",
]);

export function specialistFailures(
  results: z.output<typeof specialistResultsSchema>,
  roles: readonly SpecialistRole[],
  hasRawOutput: (role: SpecialistRole) => boolean,
): ResearchError[] {
  const failures: ResearchError[] = [];
  for (const role of roles) {
    const { status, errors } = results[role];
    if (
      status === "rejected" ||
      status === "not_run" ||
      (status === "failed" &&
        (!hasRawOutput(role) ||
          errors.some(({ code }) => fatalErrorCodes.has(code))))
    ) {
      if (errors.length) {
        failures.push(...errors);
      } else {
        failures.push({
          code: "workflow_failed",
          stage: "workflow",
          message: `Missing assigned ${role} result`,
        });
      }
    }
  }
  return failures;
}
