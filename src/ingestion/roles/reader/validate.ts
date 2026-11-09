import { validateSchema } from "../validation";
import { readerOutputSchema } from "./contracts";

export function validateReaderReply(reply: unknown) {
  return validateSchema(
    readerOutputSchema,
    reply,
    "reader",
    "Fix the listed fields. Return a complete page result for the same Markdown. Keep each valid quotation with its topics and context.",
  );
}
