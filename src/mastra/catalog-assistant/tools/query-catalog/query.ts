import Database from "better-sqlite3";
import type { z } from "zod";
import {
  SQL_LIMITS,
  queryInputSchema,
  type Cell,
  type QueryResult,
} from "./contracts";

/** The caller supplies a catalog path. SQL cannot select a file or connection. */
export function queryCatalog(
  path: string,
  input: z.input<typeof queryInputSchema>,
  signal?: AbortSignal,
): QueryResult {
  const parsed = queryInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }
  if (signal?.aborted) {
    return { ok: false, error: "cancelled" };
  }
  let client: Database.Database | undefined;
  try {
    client = new Database(path, { readonly: true, fileMustExist: true });
    client.pragma("query_only = ON");
    // SQLite parses the boundary. Never pass model SQL to exec or pragma.
    const statement = client.prepare(
      `SELECT * FROM (\n${parsed.data.sql}\n) AS catalog_query`,
    );
    if (!statement.readonly || !statement.reader) {
      return { ok: false, error: "query_rejected" };
    }
    statement.safeIntegers(true).raw(true);
    const result: Extract<QueryResult, { ok: true }> = {
      ok: true,
      columns: statement.columns().map((column) => column.name),
      rows: [],
      rowCount: 0,
      truncated: false,
    };
    if (Buffer.byteLength(JSON.stringify(result)) > SQL_LIMITS.outputBytes) {
      return { ...result, columns: [], truncated: true };
    }
    let bytes = Buffer.byteLength(
      JSON.stringify({ ...result, truncated: true }),
    );
    for (const raw of statement.iterate(
      ...(parsed.data.parameters ?? []),
    ) as Iterable<unknown[]>) {
      if (result.rows.length >= SQL_LIMITS.rows) {
        result.truncated = true;
        break;
      }
      const row = raw.map(encodeCell);
      const rowBytes = Buffer.byteLength(JSON.stringify(row)) + 1;
      // Reserve bytes for the row count and envelope changes.
      if (bytes + rowBytes + 10 > SQL_LIMITS.outputBytes) {
        result.truncated = true;
        break;
      }
      result.rows.push(row);
      bytes += rowBytes;
    }
    result.rowCount = result.rows.length;
    return result;
  } catch {
    // Driver errors can contain file paths, SQL text, or stored private content.
    return { ok: false, error: "query_rejected" };
  } finally {
    client?.close();
  }
}

// SQL cells keep their scalar type; blobs need an explicit encoding.
// eslint-disable-next-line sonarjs/function-return-type
function encodeCell(value: unknown): Cell {
  if (value === null) {
    return null;
  }
  if (typeof value === "bigint") {
    return value <= BigInt(Number.MAX_SAFE_INTEGER) &&
      value >= BigInt(Number.MIN_SAFE_INTEGER)
      ? Number(value)
      : value.toString();
  }
  if (Buffer.isBuffer(value)) {
    return { encoding: "base64", data: value.toString("base64") };
  }
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }
  throw new Error("Unsupported SQL value");
}
