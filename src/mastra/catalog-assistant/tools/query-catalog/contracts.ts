import { z } from "zod";

export const SQL_LIMITS = {
  inputBytes: 16 * 1024,
  rows: 200,
  outputBytes: 64 * 1024,
};
export const queryInputSchema = z.strictObject({
  sql: z
    .string()
    .min(1)
    .refine(
      (sql) =>
        !sql.includes("\0") && Buffer.byteLength(sql) <= SQL_LIMITS.inputBytes,
      "Invalid SQL input",
    ),
  parameters: z
    .array(z.union([z.string(), z.number(), z.null()]))
    .max(200)
    .optional(),
});
export type Cell =
  string | number | null | { encoding: "base64"; data: string };
export type QueryResult =
  | {
      ok: true;
      columns: string[];
      rows: Cell[][];
      rowCount: number;
      truncated: boolean;
    }
  | { ok: false; error: "invalid_input" | "cancelled" | "query_rejected" };
