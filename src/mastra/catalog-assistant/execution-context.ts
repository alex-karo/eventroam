import {
  createResearchBudget,
  type ResearchBudget,
} from "../../ingestion/runtime/budget";
import { loadResearchLimits } from "../../ingestion/runtime/config";
import type { RequestContext } from "@mastra/core/request-context";
import type { ProcessInputArgs } from "@mastra/core/processors";

const hostToken = Symbol("catalog-assistant-host");
const hostKey = "catalogAssistantHost";
const searchBudgetKey = "catalogResearchBudget";
const conversationKey = "catalogAssistantConversation";
export const submissionConsumedKey = "submissionConsumed";

/** Runs once at execution entry. Client context cannot create the host token. */
export const assistantExecutionContext = {
  id: "catalog-assistant-context",
  processInput({ messageList, requestContext }: ProcessInputArgs) {
    if (!requestContext) {
      throw new Error("Assistant request context unavailable");
    }
    requestContext.set(hostKey, hostToken);
    requestContext.set(submissionConsumedKey, false);
    try {
      requestContext.set(
        searchBudgetKey,
        createResearchBudget(loadResearchLimits()),
      );
    } catch {
      // Invalid search settings must not block other chat tools.
      requestContext.set(searchBudgetKey, null);
    }
    requestContext.set(
      conversationKey,
      messageList.serialize().memoryInfo?.threadId,
    );
    return messageList;
  },
};

export function trustedConversation(
  context?: RequestContext,
): string | undefined {
  if (context?.get(hostKey) !== hostToken) {
    return;
  }
  const conversation = context.get(conversationKey);
  return typeof conversation === "string" && conversation
    ? conversation
    : undefined;
}

/** Only the input processor can establish this execution's budget. */
export function trustedSearchBudget(
  context?: RequestContext,
): ResearchBudget | undefined {
  if (!trustedConversation(context)) {
    return;
  }
  const budget: ResearchBudget | null | undefined =
    context?.get(searchBudgetKey);
  if (budget === null) {
    throw new Error("Search configuration is invalid");
  }
  return budget;
}
