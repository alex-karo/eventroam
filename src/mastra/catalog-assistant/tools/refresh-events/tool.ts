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
      "Submit one to 200 distinct existing Events for background refresh. One selection per execution. Returns batch ID and accepted count. Read progress and reports through query_catalog.",
    inputSchema: refreshInputSchema.omit({ dryRun: true }),
    execute: async (input, context) =>
      submitSelection(
        catalogPath,
        logging,
        "refresh_events",
        context,
        { eventIds: input.eventIds, scope: input.scope },
        (client, consume) =>
          submitJobs(
            client,
            { eventIds: input.eventIds, scope: input.scope, dryRun: false },
            consume,
          ),
      ),
  });
}
