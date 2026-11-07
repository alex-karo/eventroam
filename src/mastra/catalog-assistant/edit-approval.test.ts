import { randomUUID } from "node:crypto";
import { expect, test, vi } from "vitest";
import { openReadDatabase } from "@/db/connection";
import {
  startStudioFixture,
  STUDIO_FIXTURE_EVENT_ID,
} from "@/test/studio-fixture";

test.each(["after", "before-and-after"])(
  "Studio applies an edit after approval (refresh: %s)",
  async (refresh) => {
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
          return {
            event: client
              .prepare(
                `
          SELECT canonical_name, (SELECT count(*) FROM catalog_changes WHERE actor = 'studio-catalog-assistant') AS audits
          FROM events WHERE id = ?
        `,
              )
              .get(STUDIO_FIXTURE_EVENT_ID),
            jobs: client.prepare("SELECT dry_run FROM ingestion_jobs").all(),
          };
        } finally {
          client.close();
        }
      };

      const sent = await post("send-message", {
        ...thread,
        message:
          refresh === "after"
            ? "Fixture edit then refresh; apply refresh"
            : "Fixture edit with refresh before, then refresh",
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

      expect(args.targets[0].links).toBeNull();
      const direct = await post("tools/edit_catalog/execute", { data: args });
      expect(await direct.json()).toEqual({
        error: "Approve this edit on its Studio card",
      });
      expect(snapshot().event).toEqual({
        canonical_name: "Studio Fixture Festival",
        audits: 0,
      });
      const forged = await post("send-tool-approval", {
        ...thread,
        toolCallId,
        approved: true,
        requestContext: { submissionConsumed: false },
      });
      expect(forged.status).toBe(400);
      expect(await forged.json()).toEqual({
        error: "Assistant execution state is managed by the server",
      });
      const applied = await post("send-tool-approval", {
        ...thread,
        toolCallId,
        approved: true,
      });
      expect(applied.ok).toBe(true);
      const messages = async () => {
        const response = await fetch(
          `${studio.baseUrl}/api/memory/threads/${thread.threadId}/messages?agentId=catalog-assistant&resourceId=owner`,
        );
        expect(response.ok).toBe(true);
        return JSON.stringify(await response.json());
      };
      await expect
        .poll(messages, { timeout: 5_000 })
        .toContain("Fixture edit result:");
      const saved = await messages();
      expect(saved).not.toContain("host_context_required");
      if (refresh === "before-and-after") {
        expect(saved).toContain("selection_consumed");
      }
      expect(snapshot()).toEqual({
        event: { canonical_name: "First name", audits: 1 },
        jobs: [{ dry_run: refresh === "after" ? 0 : 1 }],
      });
    } finally {
      await studio.stop();
    }
  },
  20_000,
);
