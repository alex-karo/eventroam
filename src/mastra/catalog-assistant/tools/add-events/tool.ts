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
      "Submit one to 200 complete descriptions for background add. A complete name or alias plus a clear country code or full official URL can skip one saved Event before source reads. Other text supplies search leads; new facts need inspected sources. One selection per execution. Returns batch ID and accepted count. Read progress and reports through query_catalog.",
    inputSchema: addJobsInputSchema,
    execute: async (input, context) =>
      submitSelection(
        catalogPath,
        logging,
        "add_events",
        context,
        { inputCount: input.inputs.length },
        (client, consume) => submitAddJobs(client, input, consume),
      ),
  });
}
