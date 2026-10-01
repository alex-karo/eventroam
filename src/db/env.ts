import { z } from "zod";

const environmentSchema = z.object({
  DATABASE_PATH: z.string().trim().min(1).default("./data/eventroam.sqlite"),
});

export type DatabaseEnvironment = z.infer<typeof environmentSchema>;

export function readDatabaseEnvironment(
  values: Record<string, string | undefined> = process.env,
): DatabaseEnvironment {
  return environmentSchema.parse(values);
}
