import type { MiddlewareHandler } from "hono";

/** Guard all native execution variants before they allocate an attempt. */
export const ingestionExecutionGuard: MiddlewareHandler = async (
  context,
  next,
) => {
  const path = context.req.path;
  if (
    !path.startsWith("/api/workflows/catalog-ingestion/") ||
    context.req.method !== "POST"
  ) {
    return next();
  }
  const operation = path.slice("/api/workflows/catalog-ingestion/".length);
  if (
    /^(resume|restart|time-travel)(?:-|$)/.test(operation) ||
    operation.endsWith("/steps/execute")
  ) {
    return context.json({ error: "Ingestion requires a fresh full run" }, 400);
  }
  if (/^(start|stream)(?:-|$|VNext)/.test(operation)) {
    let body: Record<string, unknown>;
    try {
      body = await context.req.raw.clone().json();
    } catch {
      return context.json({ error: "Invalid ingestion request" }, 400);
    }
    if (body.perStep === true || body.initialState !== undefined) {
      return context.json(
        { error: "Ingestion requires a fresh full run" },
        400,
      );
    }
  }
  return next();
};
