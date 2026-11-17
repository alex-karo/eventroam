import { z } from "zod";

export const eventScopeFields = [
  "description",
  "shortDescription",
  "links.website",
  "links.socials.instagram",
  "links.socials.facebook",
  "links.socials.youtube",
  "links.socials.tiktok",
  "links.socials.x",
  "links.socials.other",
] as const;
export const editionScopeFields = [
  "year",
  "displayName",
  "scheduleStatus",
  "sizeEstimate",
  "dates",
  "classification",
  "location",
  "tickets",
  "links.tickets",
] as const;
export const scopePresetSchema = z.enum(["full", "current"]);
const taskDetail = {
  instruction: z
    .string()
    .refine((value) => value.trim().length > 0, "Instruction must not be blank")
    .optional(),
  required: z.boolean().optional(),
};
const taskSchema = z.discriminatedUnion("target", [
  z.strictObject({
    target: z.literal("event"),
    fields: z.array(z.enum(eventScopeFields)).min(1),
    ...taskDetail,
  }),
  z.strictObject({
    target: z.enum(["currentOrNext", "latestCompleted"]),
    fields: z.array(z.enum(editionScopeFields)).min(1),
    ...taskDetail,
  }),
]);
export const scopeDefinitionSchema = z
  .strictObject({
    version: z.literal(1),
    tasks: z.array(taskSchema).min(1),
  })
  .superRefine(({ tasks }, ctx) => {
    const assigned = new Set<string>();
    tasks.forEach((task, index) =>
      task.fields.forEach((field, fieldIndex) => {
        const path = ["tasks", index, "fields", fieldIndex];
        const key = `${task.target}.${field}`;
        if (assigned.has(key)) {
          ctx.addIssue({
            code: "custom",
            path,
            message: "Field is assigned more than once for this target",
          });
        }
        assigned.add(key);
        if (
          task.target === "latestCompleted" &&
          (field === "tickets" || field === "links.tickets")
        ) {
          ctx.addIssue({
            code: "custom",
            path,
            message: "Tickets and ticket links require currentOrNext",
          });
        }
      }),
    );
  });
export const scopeRequestSchema = z.union([
  scopePresetSchema,
  scopeDefinitionSchema,
]);
export type ScopeDefinition = z.infer<typeof scopeDefinitionSchema>;
export type ScopeTask = ScopeDefinition["tasks"][number];
export type ScopeRequest = z.infer<typeof scopeRequestSchema>;
export type NormalizedScope = {
  version: 1;
  tasks: (ScopeTask & { required: boolean })[];
};
export const normalizedScopeSchema = scopeDefinitionSchema.refine(
  ({ tasks }) => tasks.every((task) => typeof task.required === "boolean"),
  "Normalized tasks require an explicit required value",
) as z.ZodType<NormalizedScope>;

const editionRequired = [
  "year",
  "displayName",
  "scheduleStatus",
  "dates",
  "classification",
  "location",
] as const;
export const scopePresets: Readonly<
  Record<z.infer<typeof scopePresetSchema>, ScopeDefinition>
> = {
  full: {
    version: 1,
    tasks: [
      { target: "event", fields: [...eventScopeFields] },
      { target: "latestCompleted", fields: [...editionRequired] },
      { target: "latestCompleted", fields: ["sizeEstimate"], required: false },
      {
        target: "currentOrNext",
        fields: [...editionRequired, "tickets", "links.tickets"],
      },
      { target: "currentOrNext", fields: ["sizeEstimate"], required: false },
    ],
  },
  current: {
    version: 1,
    tasks: [
      {
        target: "currentOrNext",
        fields: [...editionRequired, "tickets", "links.tickets"],
      },
      { target: "currentOrNext", fields: ["sizeEstimate"], required: false },
    ],
  },
};

export function normalizeScope(
  request: ScopeRequest = "full",
): NormalizedScope {
  const parsed = scopeRequestSchema.parse(request);
  const definition =
    typeof parsed === "string"
      ? scopeDefinitionSchema.parse(scopePresets[parsed])
      : parsed;
  return {
    version: 1,
    tasks: definition.tasks.map((task) => ({
      ...task,
      required: task.required ?? true,
    })),
  };
}

export const selectorSlots = {
  currentOrNext: "currentOrNextEdition",
  latestCompleted: "previousEdition",
} as const;
export function scopePath(target: ScopeTask["target"], field: string) {
  return `${target === "event" ? "event" : selectorSlots[target]}.fields.${field}`;
}

/** The attempt supplies its saved definition. Direct helpers can use a preset. */
export function effectiveScope(input: {
  scope?: ScopeRequest;
  normalizedScope?: NormalizedScope;
}): NormalizedScope {
  return input.normalizedScope ?? normalizeScope(input.scope);
}

export function requestsSlot(
  input: { scope?: ScopeRequest; normalizedScope?: NormalizedScope },
  slot: "previousEdition" | "currentOrNextEdition",
) {
  return effectiveScope(input).tasks.some(
    ({ target }) => target !== "event" && selectorSlots[target] === slot,
  );
}
