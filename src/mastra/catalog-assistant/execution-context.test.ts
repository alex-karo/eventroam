import { MessageList } from "@mastra/core/agent";
import { RequestContext } from "@mastra/core/request-context";
import type { ProcessInputStepArgs } from "@mastra/core/processors";
import { expect, test } from "vitest";
import {
  assistantExecutionContext,
  trustedConversation,
} from "./execution-context";

test("a step without saved execution state cannot establish host trust", () => {
  const requestContext = new RequestContext();
  assistantExecutionContext.processInputStep({
    messageList: new MessageList({ threadId: "owner" }),
    requestContext,
  } as ProcessInputStepArgs);
  expect(trustedConversation(requestContext)).toBeUndefined();
});
