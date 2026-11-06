import { z } from "zod";
import { addInputSchema } from "./add-input";

export const eventIdSchema = z.string().trim().min(1).max(500);
export const refreshScopeSchema = z.enum(["current", "full"]);

const addTarget = z.strictObject({
  mode: z.literal("add"),
  input: addInputSchema,
});
const refreshTarget = z.strictObject({
  mode: z.literal("refresh"),
  input: z.strictObject({ eventId: eventIdSchema, scope: refreshScopeSchema }),
});

export const ingestionTargetSchema = z.discriminatedUnion("mode", [
  addTarget,
  refreshTarget,
]);

export const studioIngestionInputSchema = z
  .strictObject({
    mode: z.enum(["add", "refresh"]),
    input: z.union([
      addTarget.shape.input,
      refreshTarget.shape.input.extend({
        scope: refreshScopeSchema.default("full"),
      }),
    ]),
    dryRun: z.boolean().default(true),
    republish: z.boolean().default(false),
  })
  .refine(
    ({ mode, input }) =>
      ingestionTargetSchema.safeParse({ mode, input }).success,
    { path: ["input"], message: "Input does not match the ingestion mode" },
  );
