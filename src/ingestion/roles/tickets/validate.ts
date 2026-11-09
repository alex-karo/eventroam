import {
  checkGroups,
  validateProposalBoundary,
  type GroupValidationInput,
} from "../proposal-validation";

export function validateTicketsReply(options: GroupValidationInput) {
  validateProposalBoundary("tickets", options);
  return checkGroups("tickets", options);
}
