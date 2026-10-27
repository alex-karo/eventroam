import { expect, test } from "vitest";
import { traceText, traceUrl } from "./labels";

test("UTF-8 bounds preserve code points and explicit omissions, with explicit omissions", () => {
  const text = traceText("🎉".repeat(300), 512);
  expect(Buffer.byteLength(text)).toBeLessThanOrEqual(512);
  expect(text).not.toContain("�");
  expect(text.endsWith("…")).toBe(true);
  expect(traceUrl("https://example.org/path?api_key=public#fragment")).toEqual({
    url: "https://example.org/path?api_key=public#fragment",
    truncated: false,
  });
});
