import { validateToolInput } from "@mastra/core/tools";
import { afterEach, expect, test, vi } from "vitest";
import { catalogEditSchema } from "@/catalog/operations/direct-edit";
import { testDatabase } from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import * as approval from "../../edit-approval";
import { createEditCatalogTool } from "./tool";

afterEach(() => vi.restoreAllMocks());

function setup() {
  const { client, path } = testDatabase();
  const event = testFixtures(client).event();
  const tool = createEditCatalogTool(() => path);
  const offer = vi.spyOn(approval, "offerCatalogEdit").mockReturnValue(true);
  const input = {
    auditMode: "record" as const,
    targets: [
      {
        kind: "event" as const,
        id: event.id,
        links: null,
        changes: {
          canonicalName: { before: event.canonicalName, after: "New name" },
        },
      },
    ],
  };
  const preview = (raw: unknown) => {
    vi.spyOn(approval, "catalogEditInput").mockReturnValue(raw);
    const validated = validateToolInput(catalogEditSchema, raw, "edit_catalog");
    expect(validated.error).toBeUndefined();
    return tool.beforeApproval!(validated.data!, {
      toolCallId: "call",
      toolName: "edit_catalog",
      requestContext: {},
    });
  };
  return { input, preview, offer };
}

test("changed values return field paths and corrected arguments before approval", async () => {
  const { input, preview, offer } = setup();
  const [target] = input.targets;
  const effective = {
    ...input,
    targets: [
      {
        ...target,
        changes: {
          ...target.changes,
          shortDescription: { before: null, after: null },
        },
      },
    ],
  };
  const raw = structuredClone(effective);
  raw.targets[0].changes.canonicalName.after = " New name ";
  Object.assign(raw.targets[0].changes, { aliases: null });

  expect(await preview(raw)).toEqual({
    proceed: false,
    output: {
      code: "edit_input_changed",
      error: expect.any(String),
      changedPaths: [
        "targets.0.changes.canonicalName.after",
        "targets.0.changes.aliases",
      ],
      effectiveInput: effective,
    },
  });
  expect(offer).not.toHaveBeenCalled();
  expect(await preview(effective)).toBeUndefined();
  expect(offer).toHaveBeenCalledOnce();
});

test("empty link lists explain how to leave links unchanged", () => {
  const { input } = setup();
  const result = catalogEditSchema.safeParse({
    ...input,
    targets: [{ ...input.targets[0], links: [] }],
  });
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        path: ["targets", 0, "links"],
        message:
          "To keep links unchanged, omit links or use null. Do not use an empty list.",
      }),
    );
  }
});

test("oversized input is rejected before returning corrected arguments", async () => {
  const { input, preview, offer } = setup();
  input.targets[0].changes.canonicalName.after = `${" ".repeat(32_768)}New name`;
  expect(await preview(input)).toEqual({
    proceed: false,
    output: {
      error: "The complete proposal is too large to show for approval",
    },
  });
  expect(offer).not.toHaveBeenCalled();
});
