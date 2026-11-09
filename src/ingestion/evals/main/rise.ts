import { check } from "../checks";
import { researchDidNotFail } from "../research";
import { termIds } from "./checks";
import type { Edition, MainContext } from "./context";
import { fact, linkFact } from "./facts";

const localities = ["Les 2 Alpes", "Les Deux Alpes"];
const festival = "validation:festival";
const music = "validation:music";
const snowSports = "validation:topic:snow-sports";

function savedEditionFacts(
  year: string,
  saved: Edition | undefined,
  edition: Edition | undefined,
) {
  const path = `edition.${year}`;
  const fields = [
    "editionKey",
    "editionYear",
    "startsOn",
    "endsOn",
    "dateState",
    "countryCode",
  ] as const;
  return [
    fact(
      `${path}.identityAndDates`,
      fields.map((field) => edition?.[field]),
      [fields.map((field) => saved?.[field])],
    ),
    // contact.md names the tourist office. The pages do not establish one venue for the Edition.
    fact(`${path}.venueName`, edition?.venueName, [null]),
    fact(`${path}.venueAddress`, edition?.venueAddress, [null]),
    fact(`${path}.sizeEstimate`, edition?.sizeEstimate, [null]),
  ];
}

function point(edition: Edition | undefined) {
  return [edition?.latitude, edition?.longitude, edition?.coordinatePrecision];
}

function supportedOffer(offer: Edition["priceDetails"][number]) {
  const { label, amount, currency, url } = offer;
  if (url != null) {
    return false;
  }
  const packageOffer = /\bpackage\b/i.test(label);
  const terms = offer.terms?.replaceAll(",", "") ?? "";
  const details = `${label} ${terms}`;
  // lineup.md advertises packages from GBP 899. This is not the base admission price.
  if (amount === 899 && currency === "GBP") {
    return (
      packageOffer && /\b(?:from|start(?:s|ing)? at|as low as)\b/i.test(details)
    );
  }
  // faq.md lists a free personal assistant ticket.
  if (amount === 0) {
    return currency == null && /\b(?:PA|personal assistant)\b/i.test(label);
  }
  if (amount != null || currency != null) {
    return false;
  }
  // faq.md announces a music-only day ticket without a price.
  if (/\bday ticket\b/i.test(label)) {
    return (
      (offer.availability ?? "unknown") === "unknown" &&
      /\bmusic[ -]only\b/i.test(details) &&
      !/[$£€]\s*\d/.test(terms)
    );
  }
  // packages.md and tickets.md show dollar amounts without an ISO currency.
  return packageOffer
    ? /\$\s*(?:1035\.42|1141\.86|1242\.78|1381\.02)\b/.test(terms)
    : /\b(?:ticket|pass)\b/i.test(label) &&
        /\blift[ -]pass\b/i.test(details) &&
        /\$\s*620\.70\b/.test(terms);
}

export function rise(context: MainContext) {
  const { original, event } = context;
  const savedPrevious = original?.editions.find(
    ({ editionKey }) => editionKey === "2025",
  );
  const savedCurrent = original?.editions.find(
    ({ editionKey }) => editionKey === "2026",
  );
  const previous = event?.editions.find(({ id }) => id === savedPrevious?.id);
  const current = event?.editions.find(({ id }) => id === savedCurrent?.id);
  const previousPoint =
    previous?.latitude == null &&
    previous?.longitude == null &&
    previous?.coordinatePrecision === "unknown"
      ? null
      : point(previous);
  const coreFacets = ["event_type", "topic", "culture", "genre"];
  return {
    required: [
      // gallery-2025-ski.md confirms the Edition took place.
      fact("edition.2025.scheduleStatus", previous?.scheduleStatus, [
        "scheduled",
      ]),
      fact("edition.2025.eventType", termIds(previous, ["event_type"]), [
        [festival],
      ]),
      // history-2025.md describes music.
      fact(
        "edition.2025.topics",
        termIds(previous, ["topic", "culture"]).filter(
          (id) => id !== snowSports,
        ),
        [[music]],
      ),
      // page.md and location.md identify the resort for the 2026 festival.
      fact("edition.2026.locality", current?.locality, localities),
    ],
    additional: [
      // gallery-2025-ski.md tags a dated photo as Santa Ski.
      fact(
        "edition.2025.snowSports",
        termIds(previous, ["topic"]).includes(snowSports) || undefined,
        [true],
      ),
      // The geocoder supplies a locality point if the venue remains unresolved.
      fact("edition.2025.point", previousPoint, [
        [45.0099949, 6.1237609, "locality"],
      ]),
      fact("edition.2026.displayName", current?.displayName, [
        "Rise 2026",
        "Rise Festival 2026",
      ]),
      // stages.md describes the slope-side and indoor stages.
      fact("edition.2026.format", termIds(current, ["format"]), [
        ["validation:mixed"],
      ]),
      // booking.md is the 2026 overview. tickets.md is the single-product checkout.
      linkFact("edition.2026.tickets", current?.links, "ticketing", [
        "https://www.rise-festival.com/book-rise-festival-2026",
      ]),
      // page.md links the festival's official accounts in its footer.
      linkFact("event.links.facebook", event?.links, "facebook", [
        "https://www.facebook.com/risefestivalofficial/",
      ]),
      linkFact("event.links.instagram", event?.links, "instagram", [
        "https://www.instagram.com/rise_festival/",
      ]),
      linkFact("event.links.tiktok", event?.links, "tiktok", [
        "https://www.tiktok.com/@rise_festival",
      ]),
      linkFact("event.links.youtube", event?.links, "youtube", [
        "https://www.youtube.com/channel/UCOvlBzmRF6xnoBTTgNZMhjg",
      ]),
    ],
    correctness: [
      ...savedEditionFacts("2025", savedPrevious, previous),
      ...savedEditionFacts("2026", savedCurrent, current),
      fact("event.name", event?.canonicalName, ["Rise Festival"]),
      fact(
        "event.website",
        event?.links
          .filter((link) => link.kind === "official_site" && link.official)
          .map((link) => link.url)
          .join(),
        ["https://www.rise-festival.com/"],
      ),
      fact("edition.2025.displayName", previous?.displayName ?? "", [
        "Rise 2025",
      ]),
      fact("edition.2025.locality", previous?.locality ?? "", localities),
      fact(
        "edition.2025.genreAndFormat",
        termIds(previous, ["genre", "format"]),
        [[]],
      ),
      fact(
        "edition.2025.tickets",
        previous?.priceKind === null &&
          previous.priceDetails.length === 0 &&
          previous.links.every((link) => link.kind !== "ticketing"),
        [true],
      ),
      fact("edition.2026.scheduleStatus", current?.scheduleStatus, [
        "scheduled",
      ]),
      fact("edition.2026.point", point(current), [point(savedCurrent)]),
      fact(
        "edition.2026.classification",
        [termIds(current, coreFacets)],
        [[termIds(savedCurrent, coreFacets)]],
      ),
      fact("edition.2026.basePrice", current?.priceKind, [null]),
      ...(current?.priceDetails ?? []).map((offer, index) =>
        fact(`edition.2026.offers.${index}`, supportedOffer(offer), [true]),
      ),
    ],
    conditions: [
      ...context.conditions,
      ...researchDidNotFail(context.report),
      check(
        "editions.identity",
        !!previous && !!current && context.created.length === 0,
      ),
      check(
        "publication",
        event?.publicationState === "published" &&
          previous?.publicationState === "published" &&
          current?.publicationState === "published",
      ),
      check("event.description", !!event?.description?.trim()),
      check("event.shortDescription", !!event?.shortDescription?.trim()),
    ],
  };
}
