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

export function createEditCatalogTool(catalogPath: () => string) {
  return createTool({
    id: "edit_catalog",
    description:
      "Propose changes to existing catalog records for approval in Studio.",
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
      if (!isDeepStrictEqual(raw, edit)) {
        return reject(
          "Show the exact effective values, including trimmed text and the audit mode",
        );
      }
      if (Buffer.byteLength(JSON.stringify(edit)) > 32_768) {
        return reject(
          "The complete proposal is too large to show for approval",
        );
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
