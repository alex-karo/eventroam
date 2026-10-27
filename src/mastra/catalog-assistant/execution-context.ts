import type { RequestContext } from "@mastra/core/request-context";
import type { ProcessInputArgs } from "@mastra/core/processors";

const hostToken = Symbol("catalog-assistant-host");
const hostKey = "catalogAssistantHost";
const conversationKey = "catalogAssistantConversation";
export const refreshConsumedKey = "refreshConsumed";

/** Runs once at execution entry. Client context cannot create the host token. */
export const assistantExecutionContext = {
  id: "catalog-assistant-context",
  processInput({ messageList, requestContext }: ProcessInputArgs) {
    if (!requestContext) {
      throw new Error("Assistant request context unavailable");
    }
    requestContext.set(hostKey, hostToken);
    requestContext.set(refreshConsumedKey, false);
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
