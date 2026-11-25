import { boundary, returnInstructions } from "../prompts";

export const TICKETS_PROMPT_VERSION = "current-tickets-v35";

export const ticketsInstructions = `## Scope

- Interpret offers only for the selected currentOrNextEdition, including an ongoing Edition.
- No historical ticket work, per-offer URLs or Edition link.

## Ticket sources

- Use the official ticket listing and dated sale updates to find the admission terms in effect on currentDate.
- Omit payment-plan offers and their schedules, deposits and financing fees from variants, terms and basePrice.
- Do not calculate admission prices from payments.
- Excluded payment plans do not need owner questions or make currentTickets unfinished.
- If sources disagree about an ordinary admission offer, omit only that offer and report the question.

## Replacement

- Propose a replacement only when evidence supports a price for at least one observed admission offer or confirms free full-programme admission.
- A published numeric price with unknown currency qualifies.
- A replacement contains the complete observed variants and basePrice with reasons and evidence.
- When neither condition is met, omit the entire tickets proposal and preserve the saved block.

## Variants

- In a supported replacement, include a variant only if it has an observed price, explicit availability or concrete admission terms.
- A category name, product link, or statement that details are elsewhere does not establish an observed offer, even with null amount and currency.
- Do not turn that navigation statement into terms or infer eligibility from a label.
- For example, when Regular is EUR 110 and Student details are only in an unread checkout, return Regular only; keep Student as an unresolved question.

- Include each distinct admission variant observed for the current sale, including limited-concert passes, day tickets, admission-and-stay packages and concessions.
- A block replaces the observed offers; it need not claim completeness of an inaccessible checkout.
- Keep known offers even when additional offers or checkout details are unknown, with unresolved questions for those gaps.
- Keep eligibility and availability per offer.

- A shared ticket list can establish the year for its offers without repeating that year beside every price.
- Use its enclosing context and dates; exclude separately dated unrelated products.
- Closed sales are not sold out.
- Do not copy unchecked old offers.

## Currency

- Use the seller's currency for each price.
- A code, name, unambiguous symbol or applicable price-list label can identify it.
- When notation is missing or shared by several currencies, such as $, use the local currency only if the cited sale market identifies it and the notation fits.
- Keep published amounts in their own currencies and use ISO codes.
- In reason, explain inferred or corrected currencies and cite the supporting evidence in evidenceIds.
- If the currency stays unknown, keep the literal published price in terms and omit amount and currency for that offer.
- For an explicitly free offer, set amount to 0. Currency is optional for a free offer.

## Base price

- An ordinary unrestricted pass for the full festival duration is general admission even when the page does not use those exact words.
- Derive a paid basePrice from ordinary unrestricted full-programme prices in one currency.
- If the seller lists the same offer in several currencies, only a price the seller identifies as primary can establish basePrice from that offer.
- If the price has no identified currency or there are several prices with no identified primary, basePrice is null unless a separate qualifying offer supports it.
- Keep supported concessions in variants.
- Free concession tickets do not make the festival free.
- When evidence explicitly establishes free full-programme admission and no ticket categories, return variants: [] with basePrice kind free; do not invent an offer.
- Otherwise a replacement needs at least one observed offer.
- Unknown base price is null.

## Examples

Fictional examples (decisions only; complete the required schema):

- Input: selected Edition 2029; its official ticket list states "Regular pass EUR 140". A mixed-year FAQ says "Under 13 free; born after 20 September 2015" without establishing which Edition this concession covers.
- Output decision: keep the supported Regular offer; omit the unconfirmed child offer and ask which Edition its full eligibility rule covers. Do not reduce the rule to "under 13" or use a page-wide 2029 heading to resolve this conflict.
- Counterexample: an explicit 2029 child offer with age, birth-date and adult-companion conditions is valid: include amount 0 and every condition in terms; the paid Regular pass remains the base price.

## Revised ticket blocks

- On a return, use the source excerpt in the note to add an applicable omitted offer or correct its price.
- Leave any unconfirmed availability or other terms open.
- Check basePrice again when you revise the block.
- Compare the pass dates with the Edition dates.
- If the evidence does not establish full-programme coverage, keep the supported pass in variants and set basePrice to null.

## Shared evidence and finding rules

${boundary}

## Return revisions
${returnInstructions}`;
