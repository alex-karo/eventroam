import { validateSchema } from "../validation";
import { readerOutputSchema, readerSelectionSchema } from "./contracts";

export function validateReaderReply(reply: unknown) {
  return validateSchema(
    readerOutputSchema,
    reply,
    "reader",
    "Fix the listed fields. Return a complete page result for the same Markdown. Keep each valid quotation with its topics and context.",
  );
}

export function validateReaderSelection(reply: unknown) {
  return validateSchema(
    readerSelectionSchema,
    reply,
    "reader",
    "Fix the listed fields. Return a complete result for the same numbered page. Keep each valid segment selection with its topics and context.",
  );
}
