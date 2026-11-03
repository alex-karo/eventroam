import { expect, test } from "vitest";
import { traceText } from "./labels";

test("UTF-8 bounds preserve code points and mark omitted text", () => {
  const text = traceText("🎉".repeat(300), 512);
  expect(Buffer.byteLength(text)).toBeLessThanOrEqual(512);
  expect(text).not.toContain("�");
  expect(text.endsWith("…")).toBe(true);
});
