import { z } from "zod";

/** Keep the full note. Trimming checks only whether it is blank. */
export const addInputSchema = z
  .string()
  .refine((value) => value.trim().length > 0, {
    message: "Add input must not be blank",
  });
