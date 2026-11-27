import { CLASSIFICATION_PROMPT_VERSION } from "./classification/prompt";
import { EDITOR_PROMPT_VERSION } from "./editor/prompt";
import { GENERAL_PROMPT_VERSION } from "./general/prompt";
import { LINKS_PROMPT_VERSION } from "./links/prompt";
import { READER_PROMPT_VERSION } from "./reader/prompt";
import { RESEARCH_PROMPT_VERSION } from "./research/prompt";
import { TICKETS_PROMPT_VERSION } from "./tickets/prompt";

export const PROMPT_VERSIONS = {
  research: RESEARCH_PROMPT_VERSION,
  reader: READER_PROMPT_VERSION,
  general: GENERAL_PROMPT_VERSION,
  tickets: TICKETS_PROMPT_VERSION,
  classification: CLASSIFICATION_PROMPT_VERSION,
  links: LINKS_PROMPT_VERSION,
  editor: EDITOR_PROMPT_VERSION,
};
