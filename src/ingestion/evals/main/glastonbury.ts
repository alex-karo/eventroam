import type { MainContext } from "./context";
import { preservedConditions } from "./context";
import { evaluate, linkFact } from "./facts";

export function glastonbury(context: MainContext) {
  // page.md confirms these links, but does not confirm the saved 2027 programme.
  return evaluate({
    required: [],
    additional: [
      linkFact("event.website", context.event?.links, "official_site", [
        "https://www.glastonburyfestivals.co.uk/",
      ]),
      linkFact("event.links.instagram", context.event?.links, "instagram", [
        "https://instagram.com/glastofest",
      ]),
      linkFact("event.links.tiktok", context.event?.links, "tiktok", [
        "https://tiktok.com/@glastonbury",
      ]),
      linkFact("event.links.facebook", context.event?.links, "facebook", [
        "https://www.facebook.com/glastonburyofficial",
      ]),
    ],
    correctness: [context.saved],
    conditions: [...context.conditions, ...preservedConditions(context)],
  });
}
