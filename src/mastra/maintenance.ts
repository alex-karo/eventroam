import { existsSync } from "node:fs";
import type { Transformer } from "node:stream/web";
import type { MiddlewareHandler } from "hono";

/** A host job sets the file before it waits for Studio to become idle. */
export function createMaintenanceControl(
  file = process.env.CATALOG_MAINTENANCE_FILE,
) {
  let active = 0;
  const paused = () => Boolean(file && existsSync(file));
  const enter = () => {
    active++;
    let released = false;
    return () => {
      if (!released) {
        released = true;
        active--;
      }
    };
  };
  const middleware: MiddlewareHandler = async (context, next) => {
    if (
      context.req.path === "/health" ||
      context.req.path === "/ingestion-queue"
    ) {
      return next();
    }
    if (paused()) {
      context.header("Retry-After", "60");
      return context.json({ error: "Studio is paused for backup" }, 503);
    }
    if (context.req.method === "GET" || context.req.method === "HEAD") {
      return next();
    }
    const leave = enter();
    try {
      await next();
      const body = context.res.body;
      if (!body) {
        leave();
        return;
      }
      // Streaming requests stay active until the consumer closes the body.
      const transformer: Transformer = {
        flush: leave,
        cancel: leave,
      };
      const { readable, writable } = new TransformStream(transformer);
      void body.pipeTo(writable).catch(leave);
      context.res = new Response(readable, context.res);
    } catch (error) {
      leave();
      throw error;
    }
  };
  return {
    paused,
    middleware,
    get active() {
      return active;
    },
    async run<T>(work: () => Promise<T>) {
      const leave = enter();
      try {
        return await work();
      } finally {
        leave();
      }
    },
  };
}

export type MaintenanceControl = ReturnType<typeof createMaintenanceControl>;
