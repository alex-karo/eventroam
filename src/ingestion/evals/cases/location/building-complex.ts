import type { LocationCaseDefinition } from "../../location";
import { pointChanged, replacePoint } from "./assertions";
import { locationInput, newTarget, locationEvidence } from "./fixture";
import { candidate, forward } from "../geocoding";
import { refreshInput } from "../fixture";

const editionKey = "hallowindie-2025";
const eventId = "event:841962431b0da5f8e6c7";

const buildingCandidates = [
  candidate({
    latitude: 42.5933469,
    longitude: -5.5835976,
    placeId:
      "51ab18f89b9a5516c0596c578dcaf24b4540f00102f90159a11b2300000000c0020192032c50616c6163696f20646520436f6e677265736f732079204578706f736963696f6e6573206465204c65c3b36e",
    label:
      "Palacio de Congresos y Exposiciones de León, Calle Gómez Salazar, 24009 León, Spain",
    name: "Palacio de Congresos y Exposiciones de León",
    countryCode: "ES",
    locality: "León",
    address: "Palacio de Congresos y Exposiciones de León",
    objectType: "venue",
    originalType: "amenity",
    confidence: 1,
  }),
];

const leonCandidates = [
  candidate({
    latitude: 42.5934528,
    longitude: -5.5616416,
    placeId:
      "51de4ac0f91e3f16c0591ddce742f64b4540f00101f9011030050000000000c002089203054c65c3b36e",
    label: "León, CL, Spain",
    name: "León",
    countryCode: "ES",
    locality: "León",
    address: "León",
    objectType: "locality",
    originalType: "city",
    category: "administrative",
    confidence: 1,
  }),
];

export const locationBuildingComplexCase: LocationCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: {
    id: "location-building-complex",
    suite: "regression",
    origin: "synthetic",
    task: "Check location building complex",
    provenance: {
      kind: "captured-adapted",
      note: "Saved descriptions, source summaries and Geoapify forward responses captured on 2026-10-24. Free-text replay hints use those captured responses. Responses use the client format and omit unused provider fields. Reverse was not captured and is explicitly unavailable. Expected actions are review assertions, not captured model output. The location evidence is an explicit synthetic statement for Hallowindie 2025 based on the captured catalog description. It replaces field-label projections and is not a quotation captured from the festival website. It supplies no point or expected action.",
    },
    input: refreshInput(eventId),
    initial: {
      event: {
        id: eventId,
        slug: "location-building-complex",
        canonicalName: "Hallowindie",
        editions: [
          {
            id: "4e779028-17d0-4050-a000-4f513bbcc3ef",
            editionKey,
            editionYear: 2025,
            startsOn: "2025-11-01",
            endsOn: "2025-11-01",
            scheduleStatus: "announced",
            latitude: null,
            longitude: null,
            coordinatePrecision: "unknown",
            venueName: "Palacio de Congresos y Exposiciones de León",
            venueAddress: null,
            locality: "León",
            administrativeArea: null,
            countryCode: "ES",
          },
        ],
      },
    },
    location: {
      group: "completion",
      input: locationInput(
        newTarget({
          editionKey,
          editionYear: 2025,
          startsOn: "2025-11-01",
          endsOn: "2025-11-01",
          scheduleStatus: "announced",
        }),
        {
          festival: {
            name: "Hallowindie",
            summary:
              "Hallowindie is a recurring Halloween festival in León, Spain.",
            format: ["indoor"],
          },
          countryBaseline: "ES",
          sources: [
            {
              url: "https://hallowindie.es/",
              information:
                "Official Hallowindie site: identifies the 2026 event and advertises October 30–31, 2026, the León venue, ticket tiers, and official social accounts; its navigation labels 2025 among previous editions.",
            },
            {
              url: "https://hallowindie.es/edicion-2025",
              information:
                "Official page identifies the 2025 edition as V Edición, lists its performers and gives its event date as November 1.",
            },
            {
              url: "https://hallowindie.es/faq",
              information:
                "Official FAQ says Hallowindie takes place at Palacio de Congresos y Exposiciones de León and links ticket sales to the official site and Marca Entradas.",
            },
            {
              url: "https://www.ctickets.es/eventos/entradas-hallowindie/8698-entradas-hallowindie-2026",
              information:
                "Hallowindie 2026 listing on the ticket channel identifies the VI edition, October 31, 2026, and the León venue; lists price tiers and says the first two tiers are finalized.",
            },
            {
              url: "https://www.ctickets.es/eventos_sesiones/comprar_entradas/11623",
              information:
                "Ticket checkout confirms the October 31 event, venue and street address; first and second tiers are closed, while third and last tiers can be selected. Prices are shown before separately stated fees.",
            },
          ],
          evidence: [
            locationEvidence(
              editionKey,
              "venue",
              "Hallowindie 2025 takes place at Palacio de Congresos y Exposiciones de León, in León, Spain.",
              [],
              "synthetic-hallowindie-2025-location",
            ),
          ],
        },
      ),
    },
    geocoding: [
      forward(
        "Palacio de Congresos y Exposiciones de León, León, ES",
        "ES",
        buildingCandidates,
      ),
      forward(
        "Palacio de Congresos y Exposiciones de León",
        "ES",
        buildingCandidates,
      ),
      forward("León, ES", "ES", leonCandidates),
      forward("León", "ES", leonCandidates),
      forward(
        "León, Castilla y León, Spain",
        "ES",
        leonCandidates,
        "Synthetic alias for the same locality query with its administrative area and country name. It reuses the captured locality response and does not establish a venue point.",
      ),
      forward(
        "León, Spain",
        "ES",
        leonCandidates,
        "Synthetic query alias for the observed city query with the full country name. Reuses the captured León locality response; it does not identify the festival venue.",
      ),
      forward(
        "Palacio de Congresos y Exposiciones de León, León, Spain",
        "ES",
        buildingCandidates,
        "Synthetic query alias for the observed venue query with the full country name. Reuses the captured response for the same venue, city and country; it is not a new provider capture.",
      ),
    ],
    sources: [],
  },
  evaluate: ({ edition }) => {
    const target = edition("hallowindie-2025");
    return [
      pointChanged(target, {
        latitude: 42.5933469,
        longitude: -5.5835976,
        precision: "approximate",
      }),
      replacePoint(target),
    ];
  },
};
