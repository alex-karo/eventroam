import type { MainCaseDefinition } from "../../main";
import { refreshInput, sourceReplay } from "../fixture";
import { candidate, forward } from "../geocoding";
import { sziget } from "./checks";

const eventId = "event:a22324dcf0078266ed4e";
const website = "https://www.szigetfestival.com/";

const budapestLocality = candidate({
  latitude: 47.49835,
  longitude: 19.04045,
  placeId: "geonames:3054643",
  label: "Budapest",
  name: "Budapest",
  countryCode: "HU",
  locality: "Budapest",
  objectType: "locality",
  originalType: "populated place",
});
const localityProvenance =
  "https://www.geonames.org/3054643/; read 2026-10-26. GeoNames CC BY. Source-backed normalized locality fixture, not a Geoapify capture. Query aliases use captured travel/contact text. This point is a locality fallback, not the venue.";

export const szigetCase = {
  fixture: {
    id: "sziget",
    suite: "main",
    origin: "captured",
    task: "fill",
    input: refreshInput(eventId),
    initial: {
      event: {
        id: eventId,
        slug: "sziget-festival-a22324dc",
        canonicalName: "Sziget Festival",
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
            id: "edition:a22324dcf0078266ed4e",
            editionKey: "source-row",
            editionYear: 2026,
            startsOn: "2026-08-11",
            endsOn: "2026-08-15",
            dateState: "confirmed",
            scheduleStatus: "scheduled",
            countryCode: "HU",
            termIds: [],
          },
        ],
      },
    },
    sources: [
      sourceReplay(website, "2026-10-30T01:31:59.336Z", "page.md", {
        finalUrl: "https://szigetfestival.com/en/",
      }),
      sourceReplay(
        "https://szigetfestival.com/en/tickets",
        "2026-10-30T01:31:59.354Z",
        "tickets.md",
        { reasonCode: "javascript_required" },
      ),
      sourceReplay(
        "https://szigetfestival.com/en/travel",
        "2026-10-30T01:31:59.421Z",
        "travel.md",
        { finalUrl: "https://szigetfestival.com/en/travel/" },
      ),
      sourceReplay(
        "https://szigetfestival.com/en/festival-info",
        "2026-10-30T01:31:59.924Z",
        "info.md",
      ),
      sourceReplay(
        "https://szigetfestival.com/en/experience",
        "2026-10-30T01:32:00.024Z",
        "experience.md",
      ),
      sourceReplay(
        "https://szigetfestival.com/en/stages",
        "2026-10-30T01:32:00.286Z",
        "stages.md",
        { finalUrl: "https://szigetfestival.com/en/stages/" },
      ),
      sourceReplay(
        "https://szigetfestival.com/en/programs-lineup-2026",
        "2026-10-30T01:32:00.439Z",
        "lineup-2026.md",
      ),
      sourceReplay(
        "https://szigetfestival.com/en/contact",
        "2026-10-30T01:32:00.504Z",
        "contact.md",
      ),
      sourceReplay(
        "https://szigetfestival.com/en/gallery",
        "2026-10-30T01:32:00.807Z",
        "gallery.md",
        { reasonCode: "javascript_required" },
      ),
    ],
    geocoding: [
      ...[
        "Budapest",
        "Budapest, HU",
        "Óbuda Island, Budapest, HU",
        "Obuda Island, Budapest, HU",
        "Óbuda Island, Május 9. park, Budapest, HU",
        "Május 9. park, Budapest, HU",
        "Május 9. park, Budapest, Hungary, 1033, Budapest, HU",
      ].map((query) =>
        forward(query, "HU", [budapestLocality], localityProvenance),
      ),
      ...[
        "Óbuda Island, Május 9. park, Budapest, Hungary, 1033, Budapest, HU",
        "Budapest, Hungary",
      ].map((query) =>
        forward(
          query,
          "HU",
          [budapestLocality],
          `${localityProvenance} This explicit alias was observed in the main run on 2026-10-27; it returns the same locality fallback, not a venue match.`,
        ),
      ),
      forward(
        "Budapest, Budapest, Hungary",
        "HU",
        [budapestLocality],
        `${localityProvenance} Observed city query in experiment c8fa18ac-8cf2-4d2d-98a6-15f9d633241e.`,
      ),
    ],
    todayUtc: "2026-10-30",
    provenance: {
      kind: "captured",
      note: "Official pages captured on 2026-10-30 through the production HTTP readPage tool with @mdream/js@2.0.3 and standard frontmatterPlugin(). Rendering was disabled. Markdown is the full reader output. HTTP status, redirects and javascript_required outcomes retain the observed results. Raw response bodies and reader results are saved locally under data/main-fixtures-mdream-20261030/sziget/. This set replaces the 2026-10-27 Markdown captures. The task, initial catalog, fixed geocoding responses and scoring rules are unchanged. Only the fixed evaluation date moves to the capture date. No live source fallback is used during evals. Location searches have one synthetic discovery response that points to the existing captured Travel page. The URL and title come from that capture; this is not a recorded search response. Source Markdown remains unchanged.",
    },
    discoveries: [
      {
        queryPattern:
          "(?=.*\\bsziget\\b)(?=.*\\b(?:venue|location|address|travel|site|island)\\b)",
        candidates: [
          {
            url: "https://szigetfestival.com/en/travel/",
            title: "Travel - #SZIGET2027",
            highlights: ["Official Sziget travel information."],
          },
        ],
      },
    ],
  },
  moduleUrl: import.meta.url,
  evaluate: sziget,
  // experience.md describes the varied music and arts programme.
  descriptionReference:
    "A large music and arts festival with a varied programme across multiple venues.",
} satisfies MainCaseDefinition;
