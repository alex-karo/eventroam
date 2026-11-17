import { describe, expect, it } from "vitest";
import {
  normalizeScope,
  scopeDefinitionSchema,
  scopePath,
  scopePresets,
  scopeRequestSchema,
} from "./scope";

describe("task scope", () => {
  it("keeps instructions and task order, with defaults only for required", () => {
    const scope = normalizeScope({
      version: 1,
      tasks: [
        { target: "event", fields: ["description"] },
        {
          target: "currentOrNext",
          fields: ["dates", "scheduleStatus"],
          instruction: "  Check complete programme dates.  ",
        },
        { target: "currentOrNext", fields: ["sizeEstimate"], required: false },
      ],
    });
    expect(scope.tasks[0]).toEqual({
      target: "event",
      fields: ["description"],
      required: true,
    });
    expect(scope.tasks[1].instruction).toBe(
      "  Check complete programme dates.  ",
    );
    expect(scope.tasks[2].required).toBe(false);
    expect(scopePath("currentOrNext", "dates")).toBe(
      "currentOrNextEdition.fields.dates",
    );
  });

  it.each([
    {},
    { version: 2, tasks: [] },
    { version: 1, tasks: [] },
    { version: 1, tasks: ["event"] },
    { version: 1, tasks: [{ target: {}, fields: ["description"] }] },
    { version: 1, tasks: [{ target: "saved:edition", fields: ["dates"] }] },
    { version: 1, tasks: [{ target: "event", fields: [] }] },
    { version: 1, tasks: [{ target: "event", fields: ["dates"] }] },
    {
      version: 1,
      tasks: [
        { target: "event", fields: ["description"], instruction: " \n " },
      ],
    },
    {
      version: 1,
      tasks: [{ target: "event", fields: ["description"], policy: "custom" }],
    },
    {
      version: 1,
      tasks: [{ target: "event", fields: ["description", "description"] }],
    },
    {
      version: 1,
      tasks: [
        { target: "event", fields: ["description"] },
        { target: "event", fields: ["description"] },
      ],
    },
    { version: 1, tasks: [{ target: "latestCompleted", fields: ["tickets"] }] },
    {
      version: 1,
      tasks: [{ target: "latestCompleted", fields: ["links.tickets"] }],
    },
  ])("rejects invalid scope with an input path: %j", (value) => {
    const result = scopeDefinitionSchema.safeParse(value);
    expect(result.success).toBe(false);
    expect(result.error?.issues.length).toBeGreaterThan(0);
    expect(result.error?.issues[0].path.length).toBeGreaterThan(0);
  });

  it("expands presets through the same validator and preserves field coverage", () => {
    for (const name of ["full", "current"] as const) {
      expect(scopeRequestSchema.parse(name)).toBe(name);
      expect(scopeDefinitionSchema.safeParse(scopePresets[name]).success).toBe(
        true,
      );
    }
    expect(
      normalizeScope("current").tasks.every(
        ({ target }) => target === "currentOrNext",
      ),
    ).toBe(true);
    expect(
      normalizeScope("full").tasks.some(
        ({ target }) => target === "latestCompleted",
      ),
    ).toBe(true);
    expect(
      normalizeScope("full")
        .tasks.filter(({ required }) => !required)
        .flatMap(({ fields }) => fields),
    ).toEqual(["sizeEstimate", "sizeEstimate"]);
  });
});
