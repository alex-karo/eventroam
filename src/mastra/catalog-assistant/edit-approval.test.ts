import { randomUUID } from "node:crypto";
import { expect, test, vi } from "vitest";
import { openReadDatabase } from "@/db/connection";
import {
  startStudioFixture,
  STUDIO_FIXTURE_EVENT_ID,
} from "@/test/studio-fixture";

test("Studio applies an edit after approval in the chat thread", async () => {
  const studio = await startStudioFixture();
  try {
    const thread = { threadId: randomUUID(), resourceId: "owner" };
    const agentUrl = `${studio.baseUrl}/api/agents/catalog-assistant`;
    const post = (action: string, body: object) =>
      fetch(`${agentUrl}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    const snapshot = () => {
      const { client } = openReadDatabase(studio.catalogPath);
      try {
        return client
          .prepare(
            `
          SELECT canonical_name, (SELECT count(*) FROM catalog_changes) AS audits
          FROM events WHERE id = ?
        `,
          )
          .get(STUDIO_FIXTURE_EVENT_ID);
      } finally {
        client.close();
      }
    };

    const sent = await post("send-message", {
      ...thread,
      message: "Fixture edit",
    });
    expect(sent.ok).toBe(true);
    const { toolCallId, args } = await vi.waitFor(
      async () => {
        const pending = await fetch(
          `${agentUrl}/suspended-runs?${new URLSearchParams(thread)}`,
        );
        const { runs } = await pending.json();
        const call = runs?.[0]?.toolCalls[0];
        expect(call).toMatchObject({
          toolName: "edit_catalog",
          requiresApproval: true,
        });
        return call;
      },
      { timeout: 5_000 },
    );

    const direct = await post("tools/edit_catalog/execute", { data: args });
    expect(await direct.json()).toEqual({
      error: "Approve this edit on its Studio card",
    });
    expect(snapshot()).toEqual({
      canonical_name: "Studio Fixture Festival",
      audits: 0,
    });
    const applied = await post("send-tool-approval", {
      ...thread,
      toolCallId,
      approved: true,
    });
    expect(applied.ok).toBe(true);
    await expect.poll(snapshot).toEqual({
      canonical_name: "First name",
      audits: 1,
    });
  } finally {
    await studio.stop();
  }
}, 20_000);
