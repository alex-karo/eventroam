import type { MainCaseDefinition } from "../../main";
import { refreshInput, sourceReplay } from "../fixture";
import { candidate, forward } from "../geocoding";
import { roskilde } from "./checks";

const eventId = "event:87b1f34093d76b709011";
const website = "https://www.roskilde-festival.dk/";

const roskildeLocality = candidate({
  latitude: 55.64152,
  longitude: 12.08035,
  placeId: "geonames:2614481",
  label: "Roskilde",
  name: "Roskilde",
  countryCode: "DK",
  locality: "Roskilde",
  objectType: "locality",
  originalType: "populated place",
});
const localityProvenance =
  "https://www.geonames.org/2614481/; read 2026-10-26. GeoNames CC BY. Source-backed normalized locality fixture, not a Geoapify capture. Query aliases use captured travel/contact text. This point is a locality fallback, not the venue.";

export const roskildeCase = {
  fixture: {
    id: "roskilde",
    suite: "main",
    origin: "captured",
    task: "fill",
    input: refreshInput(eventId),
    initial: {
      event: {
        id: eventId,
        slug: "roskilde-festival-87b1f340",
        canonicalName: "Roskilde Festival",
        links: [
          {
            kind: "other",
            url: website,
            label: "Website (unverified)",
            official: false,
          },
        ],
        editions: [
          {
            id: "edition:87b1f34093d76b709011",
            editionKey: "source-row",
            editionYear: 2026,
            startsOn: "2026-06-27",
            endsOn: "2026-07-04",
            dateState: "confirmed",
            scheduleStatus: "scheduled",
            countryCode: "DK",
            termIds: [],
          },
        ],
      },
    },
    sources: [
      sourceReplay(website, "2026-10-30T01:31:56.358Z", "page.md"),
      sourceReplay(
        `${website}billetter`,
        "2026-10-30T01:31:56.361Z",
        "tickets.md",
      ),
      sourceReplay(
        `${website}kontakt`,
        "2026-10-30T01:31:56.361Z",
        "contact.md",
      ),
      sourceReplay(
        `${website}festival-med-formaal`,
        "2026-10-30T01:31:56.999Z",
        "purpose.md",
      ),
      sourceReplay(
        `${website}nyheder/rf27-de-foerste-18-navne-er-klar`,
        "2026-10-30T01:31:57.018Z",
        "first-artists.md",
      ),
      sourceReplay(
        `${website}program`,
        "2026-10-30T01:31:57.035Z",
        "program.md",
      ),
      sourceReplay(
        `${website}nyheder/goer-dig-klar-til-at-koebe-billet-til-rf27`,
        "2026-10-30T01:31:57.329Z",
        "ticket-sale.md",
      ),
      sourceReplay(
        `${website}nyheder/tessa-sender-aarets-orange-donation-til-amnesty`,
        "2026-10-30T01:31:57.391Z",
        "donation.md",
      ),
      sourceReplay(`${website}nyheder`, "2026-10-30T01:31:57.606Z", "news.md"),
      sourceReplay(
        `${website}saadan-er-roskilde`,
        "2026-10-30T01:31:57.636Z",
        "about.md",
      ),
      sourceReplay(
        "https://faq.roskilde-festival.dk/hc/da/categories/10127594054813-Roskilde-Festival",
        "2026-10-30T01:31:57.818Z",
        "faq.md",
      ),
      sourceReplay(
        `${website}nyheder/tak-for-i-aar-vi-ses-i-2027`,
        "2026-10-30T01:31:57.873Z",
        "wrap-up.md",
      ),
    ],
    geocoding: [
      ...[
        "Roskilde",
        "Roskilde, DK",
        "Darupvej 19, Roskilde, DK",
        "Festivalpladsen, Darupvej 19, Roskilde, DK",
        "Roskilde Festival, Darupvej 19, Roskilde, DK",
        "Roskilde Festivalplads, Darupvej 19, Roskilde, DK",
        "Darupvej 19, 4000 Roskilde, Roskilde, DK",
      ].map((query) =>
        forward(query, "DK", [roskildeLocality], localityProvenance),
      ),
      ...[
        "Festivalpladsen, Darupvej 19, 4000 Roskilde, Roskilde, DK",
        "Roskilde, Region Zealand, Denmark",
      ].map((query) =>
        forward(
          query,
          "DK",
          [roskildeLocality],
          `${localityProvenance} Observed Roskilde query alias in run b6aac593-a425-48b4-8717-58ef9a690b9c; the response remains a city result and does not assert a venue point or region.`,
        ),
      ),
      forward(
        "Festivalpladsen, Darupvej 19, Roskilde",
        "DK",
        [roskildeLocality],
        `${localityProvenance} Observed address alias in experiment a2bef149-7ecb-47b5-9794-db4dbfb898c3. The response remains a Roskilde city fallback, not a venue point.`,
      ),
    ],
    todayUtc: "2026-10-30",
    provenance: {
      kind: "captured",
      note: "Official pages captured on 2026-10-30 through the production HTTP readPage tool with @mdream/js@2.0.3 and standard frontmatterPlugin(). Rendering was disabled. Markdown is the full reader output. HTTP status, redirects and javascript_required outcomes retain the observed results. Raw response bodies and reader results are saved locally under data/main-fixtures-mdream-20261030/roskilde/. This set replaces the 2026-10-27 Markdown captures. The task, initial catalog, fixed geocoding responses and scoring rules are unchanged. Only the fixed evaluation date moves to the capture date. No live source fallback is used during evals.",
    },
  },
  moduleUrl: import.meta.url,
  evaluate: roskilde,
  // about.md describes the concerts and communal camping.
  descriptionReference:
    "A music festival with concerts and a large camping community.",
} satisfies MainCaseDefinition;
