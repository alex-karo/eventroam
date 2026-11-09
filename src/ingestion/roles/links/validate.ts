import { atPath } from "../../groups";
import {
  checkGroups,
  validateProposalBoundary,
  type GroupValidationInput,
  failProposal,
} from "../proposal-validation";

export function validateLinksReply(options: GroupValidationInput) {
  validateProposalBoundary("links", options);
  if (
    !options.ctx.targets?.currentOrNextEdition &&
    atPath(options.reply.raw, "currentOrNextEdition") != null
  ) {
    failProposal("Link proposal for an absent target");
  }
  return checkGroups("links", options);
}
