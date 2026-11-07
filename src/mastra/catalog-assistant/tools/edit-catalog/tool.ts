import { isDeepStrictEqual } from "node:util";
import { createTool } from "@mastra/core/tools";
import { catalogEditSchema } from "@/catalog/operations/direct-edit";
import {
  applyCatalogEdit,
  catalogEditFailure,
  verifyEditPreview,
} from "@/catalog/write/direct-edit";
import { openDatabase, openReadDatabase } from "@/db/connection";
import {
  catalogEditInput,
  offerCatalogEdit,
  rememberCatalogEditInput,
  takeCatalogEditApproval,
} from "../../edit-approval";

function changedPaths(before: unknown, after: unknown, path = ""): string[] {
  if (isDeepStrictEqual(before, after)) {
    return [];
  }
  if (
    before !== null &&
    after !== null &&
    typeof before === "object" &&
    typeof after === "object" &&
    Array.isArray(before) === Array.isArray(after)
  ) {
    const left = before as Record<string, unknown>;
    const right = after as Record<string, unknown>;
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    return [...keys].flatMap((key) => {
      const field = path ? `${path}.${key}` : key;
      if (Object.hasOwn(left, key) !== Object.hasOwn(right, key)) {
        return [field];
      }
      return changedPaths(left[key], right[key], field);
    });
  }
  return [path || "$"];
}

export function createEditCatalogTool(catalogPath: () => string) {
  return createTool({
    id: "edit_catalog",
    description:
      "Propose changes to existing catalog records for approval on a Studio card. Field edits do not need links. Omit links or use null to keep links unchanged. Supply links only to edit existing links owned by the target.",
    inputSchema: catalogEditSchema,
    requireApproval: true,
    onInputAvailable: ({ toolCallId, input }) =>
      rememberCatalogEditInput(toolCallId, input),
    beforeApproval: (edit, { toolCallId }) => {
      const reject = (error: string) => ({
        proceed: false as const,
        output: { error },
      });
      const raw = catalogEditInput(toolCallId);
      if (!raw) {
        return reject("Send a new chat message to propose this edit");
      }
      if (
        Buffer.byteLength(JSON.stringify(raw)) > 32_768 ||
        Buffer.byteLength(JSON.stringify(edit)) > 32_768
      ) {
        return reject(
          "The complete proposal is too large to show for approval",
        );
      }
      if (!isDeepStrictEqual(raw, edit)) {
        return {
          proceed: false as const,
          output: {
            code: "edit_input_changed",
            error:
              "Input processing changed the proposal. Submit effectiveInput as the corrected tool arguments for Studio approval. Repeating the chat confirmation does not fix this error.",
            changedPaths: changedPaths(raw, edit),
            effectiveInput: edit,
          },
        };
      }
      try {
        const { client } = openReadDatabase(catalogPath());
        try {
          client.transaction(() => verifyEditPreview(client, edit))();
        } finally {
          client.close();
        }
      } catch (error) {
        return reject(catalogEditFailure(error));
      }
      if (!offerCatalogEdit()) {
        return reject("Send a new chat message to propose another edit");
      }
    },
    execute: async (edit, context) => {
      const pair = takeCatalogEditApproval(context?.agent?.toolCallId);
      if (!pair) {
        return { error: "Approve this edit on its Studio card" };
      }
      try {
        const { client } = openDatabase(catalogPath(), { fileMustExist: true });
        try {
          return {
            auditMode: edit.auditMode,
            targets: applyCatalogEdit(client, edit, pair),
          };
        } finally {
          client.close();
        }
      } catch (error) {
        return { error: catalogEditFailure(error) };
      }
    },
  });
}
