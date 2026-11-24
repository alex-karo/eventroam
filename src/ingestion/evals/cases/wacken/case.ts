import type { MainCaseDefinition } from "../../main";
import { refreshInput, sourceReplay } from "../fixture";
import { candidate, forward } from "../geocoding";
import { wacken } from "./checks";

const eventId = "event:792d44feb71838d4b28b";
const website = "https://www.wacken.com/";

const wackenLocality = candidate({
  latitude: 54.02078040137254,
  longitude: 9.375972747802734,
  label: "Wacken",
  name: "Wacken",
  countryCode: "DE",
  locality: "Wacken",
  objectType: "locality",
  originalType: "populated place",
});
const localityProvenance =
  "https://www.geonames.org/search.html?q=Steinburg&startRow=250; read 2026-10-26, Wacken populated-place entry. GeoNames CC BY 4.0. Source-backed normalized locality fixture, not a Geoapify capture. Query aliases use captured travel text. Locality fallback, not the venue.";

export const wackenCase = {
  fixture: {
    id: "wacken",
    suite: "main",
    origin: "captured",
    task: "fill",
    input: refreshInput(eventId),
    initial: {
      event: {
        id: eventId,
        slug: "wacken-open-air-792d44fe",
        canonicalName: "Wacken Open Air",
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
            id: "edition:792d44feb71838d4b28b",
            editionKey: "source-row",
            editionYear: 2026,
            startsOn: "2026-07-30",
            endsOn: "2026-08-01",
            dateState: "confirmed",
            scheduleStatus: "scheduled",
            countryCode: "DE",
            termIds: [],
          },
        ],
      },
    },
    sources: [
      sourceReplay(website, "2026-10-30T01:31:57.940Z", "page.md", {
        finalUrl: `${website}de/`,
      }),
      sourceReplay(
        `${website}de/tickets-shop/ticket-uebersicht-2027/`,
        "2026-10-30T01:31:58.129Z",
        "tickets.md",
      ),
      sourceReplay(
        `${website}de/camping-travel/die-uebersicht/`,
        "2026-10-30T01:31:58.323Z",
        "travel.md",
      ),
      sourceReplay(
        `${website}de/news-details/woa-2026-das-offizielle-aftermovie-ist-da/`,
        "2026-10-30T01:31:58.666Z",
        "aftermovie.md",
      ),
      sourceReplay(
        `${website}de/alle-news/`,
        "2026-10-30T01:31:58.801Z",
        "news.md",
      ),
      sourceReplay(
        `${website}de/historie/`,
        "2026-10-30T01:31:58.822Z",
        "history.md",
        { reasonCode: "javascript_required" },
      ),
      sourceReplay(
        `${website}de/kontakt/`,
        "2026-10-30T01:31:58.834Z",
        "contact.md",
        { reasonCode: "javascript_required" },
      ),
      sourceReplay(
        `${website}de/impressum/`,
        "2026-10-30T01:31:58.975Z",
        "impressum.md",
        { status: "failed", reasonCode: "http_404" },
      ),
      sourceReplay(
        `${website}de/news-details/die-ticketboerse-fuer-das-woa-2027-ist-online/`,
        "2026-10-30T01:31:58.987Z",
        "ticket-exchange.md",
      ),
      sourceReplay(
        `${website}de/rechtliches/impressum/`,
        "2026-10-30T01:31:59.129Z",
        "legal-impressum.md",
      ),
      sourceReplay(
        `${website}de/line-up/bands/`,
        "2026-10-30T01:31:59.189Z",
        "bands.md",
        { reasonCode: "javascript_required" },
      ),
      sourceReplay(
        `${website}de/news-details/ein-gaensehautmoment-auf-dem-wacken-open-air-ein-letzter-wunsch-wird-wahr/`,
        "2026-10-30T01:31:59.218Z",
        "last-wish.md",
      ),
      sourceReplay(
        `${website}de/news-details/heavy-metal-erobert-die-reeperbahn-wacken-open-air-showcase-morecore-music-awards/`,
        "2026-10-30T01:31:59.279Z",
        "showcase.md",
      ),
    ],
    geocoding: [
      ...[
        "Wacken",
        "Wacken, DE",
        "Wacken Open Air, Wacken, DE",
        "Holy Ground, Wacken, DE",
      ].map((query) =>
        forward(query, "DE", [wackenLocality], localityProvenance),
      ),
      ...["Wacken, Schleswig-Holstein, Germany", "Wacken, Germany"].map(
        (query) =>
          forward(
            query,
            "DE",
            [wackenLocality],
            `${localityProvenance} This explicit alias was observed in the main run on 2026-10-27; it returns the same locality fallback, not a venue match.`,
          ),
      ),
    ],
    todayUtc: "2026-10-30",
    provenance: {
      kind: "captured",
      note: "Official pages captured on 2026-10-30 through the production HTTP readPage tool with @mdream/js@2.0.3 and standard frontmatterPlugin(). Rendering was disabled. Markdown is the full reader output. HTTP status, redirects and javascript_required outcomes retain the observed results. Raw response bodies and reader results are saved locally under data/main-fixtures-mdream-20261030/wacken/. This set replaces the 2026-10-27 Markdown captures. The task, initial catalog, fixed geocoding responses and scoring rules are unchanged. Only the fixed evaluation date moves to the capture date. No live source fallback is used during evals.",
    },
  },
  moduleUrl: import.meta.url,
  evaluate: wacken,
  // page.md describes an open-air festival for heavy metal fans.
  descriptionReference:
    "An open-air music festival centred on heavy metal and its fans.",
} satisfies MainCaseDefinition;
