import { createTool } from "@mastra/core/tools";
import {
  submitAddJobs,
  addJobsInputSchema,
} from "../../../../ingestion/jobs/store";
import type { AssistantLogging } from "../../logging";
import { submitSelection } from "../submit-selection";

export function createAddEventsTool(
  catalogPath: () => string,
  logging?: AssistantLogging,
) {
  return createTool({
    id: "add_events",
    description:
      "Submit one to 200 complete descriptions for background add. All text is search leads. dryRun defaults to preview; false applies. One selection per execution. Returns batch ID and accepted count. Read progress and reports through query_catalog.",
    inputSchema: addJobsInputSchema,
    execute: async (input, context) =>
      submitSelection(
        catalogPath,
        logging,
        "add_events",
        context,
        { inputCount: input.inputs.length, dryRun: input.dryRun },
        (client, consume) => submitAddJobs(client, input, consume),
      ),
  });
}
