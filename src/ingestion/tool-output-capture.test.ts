import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { afterEach, expect, test, vi } from "vitest";
import {
  createToolOutputCapture,
  ToolOutputCapture,
} from "./tool-output-capture";

const roots: string[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  const { rmSync } = await import("node:fs");
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});
function root() {
  const directory = mkdtempSync(join(tmpdir(), "catalog-capture-"));
  roots.push(directory);
  return directory;
}

test("exact opt-in switch", () => {
  vi.stubEnv("CATALOG_CAPTURE_TOOL_OUTPUTS", "TRUE");
  expect(createToolOutputCapture("run")).toBeUndefined();
  vi.stubEnv("CATALOG_CAPTURE_TOOL_OUTPUTS", "true");
  expect(createToolOutputCapture("run")).toBeInstanceOf(ToolOutputCapture);
});

test("writes ordered private JSON and bounded Markdown", () => {
  const destination = root();
  const capture = new ToolOutputCapture("run-1", destination);
  const first = capture.reserve();
  const second = capture.reserve();
  capture.save(
    second,
    "searchWeb",
    { candidates: [], remaining: { searches: 2 } },
    "call-2",
  );
  capture.save(
    first,
    "readPage",
    { markdown: "Visible only", remaining: { searches: 3 } },
    "call-1",
  );
  const files = readdirSync(join(destination, "run-1"));
  expect(files).toEqual([
    "00001-readPage.json",
    "00001-readPage.md",
    "00002-searchWeb.json",
  ]);
  expect(
    JSON.parse(readFileSync(join(destination, "run-1", files[0]), "utf8")),
  ).toEqual({
    sequence: 1,
    runId: "run-1",
    origin: "readPage",
    toolCallId: "call-1",
    result: { markdown: "Visible only", remaining: { searches: 3 } },
  });
  expect(readFileSync(join(destination, "run-1", files[1]), "utf8")).toBe(
    "Visible only",
  );
  expect(statSync(join(destination, "run-1")).mode & 0o777).toBe(0o700);
  for (const file of files) {
    expect(statSync(join(destination, "run-1", file)).mode & 0o777).toBe(0o600);
  }
});

test("directory and file failures disable capture and emit one safe diagnostic", () => {
  const destination = root();
  const stderr = vi
    .spyOn(process.stderr, "write")
    .mockImplementation(() => true);
  const blocked = join(destination, "blocked");
  writeFileSync(blocked, "x");
  const first = new ToolOutputCapture("run-1", blocked);
  first.save(first.reserve(), "readPage", { markdown: "SECRET" });
  first.save(first.reserve(), "searchWeb", { query: "PRIVATE" });
  expect(stderr).toHaveBeenCalledTimes(1);
  expect(String(stderr.mock.calls[0][0])).toBe(
    "catalog_capture_write_failed runId=run-1 phase=readPage\n",
  );

  const second = new ToolOutputCapture("run-2", destination);
  second.save(second.reserve(), "initial-source", { markdown: "first" });
  writeFileSync(join(destination, "run-2", "00002-searchWeb.json"), "blocked");
  second.save(second.reserve(), "searchWeb", { query: "PRIVATE" });
  second.save(second.reserve(), "readPage", { markdown: "SECRET" });
  expect(stderr).toHaveBeenCalledTimes(2);
  expect(readdirSync(join(destination, "run-2"))).toEqual([
    "00001-initial-source.json",
    "00001-initial-source.md",
    "00002-searchWeb.json",
  ]);
});

test("capture failure remains harmless when stderr is closed", () => {
  const destination = root();
  const blocked = join(destination, "blocked");
  writeFileSync(blocked, "x");
  const closed = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  closed.end();
  const stderr = vi
    .spyOn(process, "stderr", "get")
    .mockReturnValue(closed as typeof process.stderr);
  const capture = new ToolOutputCapture("run-3", blocked);
  expect(() =>
    capture.save(capture.reserve(), "readPage", { markdown: "SECRET" }),
  ).not.toThrow();
  stderr.mockRestore();
});
