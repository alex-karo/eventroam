import { expect, test } from "vitest";
import { MastraTimeoutError } from "@mastra/core/loop";
import { classifyModelError } from "./model-errors";
import { ResearchLimitError } from "./budget";

test("nested model errors retain only bounded diagnostic metadata", () => {
  const secret = "PRIVATE_PROVIDER_TOKEN";
  const cause = Object.assign(new TypeError(secret), {
    code: "ECONNRESET",
    isRetryable: true,
    cause: Object.assign(new Error(secret), { code: 429 }),
  });
  const error = Object.assign(new Error(secret), {
    name: secret,
    statusCode: 503,
    code: secret,
    headers: { authorization: secret },
    cause,
  });
  const classified = classifyModelError(error, Date.now() + 60_000);
  expect(classified).toEqual({
    limit: undefined,
    diagnostic: {
      errorTypes: ["UnknownError", "TypeError", "Error"],
      httpStatus: 503,
      providerCode: "ECONNRESET",
      retryable: true,
    },
  });
  expect(JSON.stringify(classified)).not.toContain(secret);
  expect(
    classifyModelError(
      Object.assign(new Error(), { data: { error: { code: 429 } } }),
      Date.now() + 60_000,
    ).diagnostic.providerCode,
  ).toBe(429);
});

test("nested research limit takes precedence over model diagnostics", () => {
  const classified = classifyModelError(
    Object.assign(new Error("provider wrapper"), {
      statusCode: 503,
      cause: new ResearchLimitError("searches"),
    }),
    Date.now() + 60_000,
  );
  expect(classified.limit?.limit).toBe("searches");
});

test.each(["step", "total", "firstChunk"] as const)(
  "native Mastra %s timeout is a time limit with safe diagnostics",
  (timeoutType) => {
    const error = new MastraTimeoutError({ timeoutType, timeoutMs: 100 });
    const classified = classifyModelError(error, 1_000, 0);
    expect(classified.limit?.limit).toBe("time");
    expect(classified.diagnostic).toEqual({ errorTypes: ["UnknownError"] });
  },
);

test.each(["time", "searches", "depth"] as const)(
  "serialized %s limit survives both retained forms without leaking payloads",
  (limit) => {
    const secret = "PRIVATE_PROVIDER_TOKEN";
    for (const cause of [
      { name: "ResearchLimitError", limit, message: secret },
      { message: `Research ${limit} limit exhausted`, data: secret },
    ]) {
      const classified = classifyModelError(
        Object.assign(new Error(secret), { cause }),
        1_000,
        0,
      );
      expect(classified.limit?.limit).toBe(limit);
      expect(classified.diagnostic).toEqual({
        errorTypes: "name" in cause ? ["Error", "UnknownError"] : ["Error"],
      });
      expect(JSON.stringify(classified)).not.toContain(secret);
    }
  },
);

test("cyclic causes stop traversal and keep only safe metadata", () => {
  const secret = "PRIVATE_PROVIDER_TOKEN";
  const error = Object.assign(new Error(secret), { code: secret });
  const cause = Object.assign(new TypeError(secret), {
    statusCode: 429,
    code: "rate_limit_exceeded",
    isRetryable: false,
    cause: error,
  });
  Object.assign(error, { cause });
  const classified = classifyModelError(error, 1_000, 0);
  expect(classified).toEqual({
    limit: undefined,
    diagnostic: {
      errorTypes: ["Error", "TypeError"],
      httpStatus: 429,
      providerCode: "rate_limit_exceeded",
      retryable: false,
    },
  });
  expect(JSON.stringify(classified)).not.toContain(secret);
});

test("completion time controls the deadline fallback without replacing explicit limits", () => {
  expect(classifyModelError(new Error(), 1_000, 999).limit).toBeUndefined();
  expect(classifyModelError(new Error(), 1_000, 1_000).limit?.limit).toBe(
    "time",
  );
  expect(
    classifyModelError(new ResearchLimitError("searches"), 1_000, 1_001).limit
      ?.limit,
  ).toBe("searches");
});
