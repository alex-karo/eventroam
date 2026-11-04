import { createTool } from "@mastra/core/tools";
import {
  submitJobs,
  refreshInputSchema,
} from "../../../../ingestion/jobs/store";
import type { AssistantLogging } from "../../logging";
import { submitSelection } from "../submit-selection";

export function createRefreshEventsTool(
  catalogPath: () => string,
  logging?: AssistantLogging,
) {
  return createTool({
    id: "refresh_events",
    description:
      "Submit one to 200 distinct existing Events for background refresh. dryRun defaults to preview; false applies. One selection per execution. Returns batch ID and accepted count. Read progress and reports through query_catalog.",
    inputSchema: refreshInputSchema,
    execute: async (input, context) =>
      submitSelection(
        catalogPath,
        logging,
        "refresh_events",
        context,
        { eventIds: input.eventIds, scope: input.scope, dryRun: input.dryRun },
        (client, consume) => submitJobs(client, input, consume),
      ),
  });
}
