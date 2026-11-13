import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import { expect, test } from "vitest";
import { createMaintenanceControl } from "./maintenance";

test("backup blocks new writes and waits for the active stream", async ({
  onTestFinished,
}) => {
  const root = mkdtempSync(join(tmpdir(), "studio-maintenance-"));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  const file = join(root, "pause");
  const control = createMaintenanceControl(file);
  const app = new Hono();
  let stream: ReadableStreamDefaultController;
  app.use(control.middleware);
  app.post("/stream", (c) =>
    c.body(
      new ReadableStream({
        start: (controller) => {
          stream = controller;
        },
      }),
    ),
  );
  app.post("/work", (c) => c.text("started"));
  const response = await app.request("/stream", { method: "POST" });
  expect(control.active).toBe(1);
  writeFileSync(file, "backup");
  expect((await app.request("/work", { method: "POST" })).status).toBe(503);
  stream!.close();
  await response.text();
  expect(control.active).toBe(0);
  rmSync(file);
  expect((await app.request("/work", { method: "POST" })).status).toBe(200);
});
