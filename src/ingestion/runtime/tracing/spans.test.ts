import { SpanType } from "@mastra/core/observability";
import { Observability, TestExporter } from "@mastra/observability";
import { expect, test, vi } from "vitest";
import type { RunObservability } from "../observability/runtime";
import { traceFailure } from "./spans";

function tracedSpan() {
  const observability = new Observability({
    configs: {
      test: { serviceName: "test", exporters: [new TestExporter()] },
    },
  });
  const root = observability.getDefaultInstance()!.startSpan({
    type: SpanType.WORKFLOW_RUN,
    name: "catalog-ingestion",
  });
  const diagnose = vi.fn();
  const tracing = { root, diagnose } as unknown as RunObservability;
  return { observability, root, diagnose, tracing };
}

test("a later failure summary keeps the original exception and role context", async () => {
  const { observability, root, tracing } = tracedSpan();
  const error = new Error("The provider rejected the Reader request");
  try {
    traceFailure(tracing, "research_failed", {
      error,
      metadata: { role: "reader", httpStatus: 401 },
    });
    traceFailure(tracing, "workflow_failed");
    expect(root.errorInfo).toMatchObject({
      message: error.message,
      stack: error.stack,
    });
    expect(root.metadata?.failure).toEqual({
      code: "research_failed",
      role: "reader",
      httpStatus: 401,
    });
    expect(root.endTime).toBeUndefined();
  } finally {
    root.end();
    await observability.shutdown();
  }
});

test("each exception replaces the full context of the previous failure", async () => {
  const { observability, root, tracing } = tracedSpan();
  try {
    traceFailure(tracing, "research_failed", {
      error: new Error("The provider is unavailable"),
      metadata: {
        role: "reader",
        model: "fixture/reader",
        httpStatus: 503,
        providerCode: "server_error",
        retryable: true,
      },
    });
    const timeout = new Error("The Editor reached the deadline");
    traceFailure(tracing, "research_failed", {
      error: timeout,
      metadata: { role: "editor", model: "fixture/editor", limit: "time" },
    });
    expect(root.errorInfo).toMatchObject({ message: timeout.message });
    expect(root.metadata?.failure).toEqual({
      code: "research_failed",
      role: "editor",
      model: "fixture/editor",
      limit: "time",
    });
  } finally {
    root.end();
    await observability.shutdown();
  }
});

test("recording an exception cannot interrupt ingestion", async () => {
  const { observability, root, diagnose, tracing } = tracedSpan();
  vi.spyOn(root, "error").mockImplementation(() => {
    throw new Error("Trace storage unavailable");
  });
  try {
    expect(() =>
      traceFailure(tracing, "research_failed", {
        error: new Error("The model failed"),
      }),
    ).not.toThrow();
    expect(diagnose).toHaveBeenCalledWith("trace_export_failed");
  } finally {
    root.end();
    await observability.shutdown();
  }
});
