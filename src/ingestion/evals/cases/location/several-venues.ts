import type { LocationCaseDefinition } from "../../location";
import { pointChanged, pointQuestion, replacePoint } from "./assertions";
import { locationInput, newTarget, locationEvidence } from "./fixture";
import { candidate, forward } from "../geocoding";
import { refreshInput } from "../fixture";

const editionKey = "ageas-cooljazz-2027";
const eventId = "event:d2f08eac8f3289da9c06";

const hippodromeCandidates = [
  candidate({
    latitude: 38.6935115,
    longitude: -9.4253156,
    placeId:
      "510df560f7c2d922c05930f31dfcc4584340f00102f901f09baf0100000000c00201920319486970c3b364726f6d6f204d616e75656c20506f73736f6c6f",
    label:
      "Hipódromo Manuel Possolo, Rua Visconde da Gandarinha, Cascais e Estoril, 2750-433 Cascais, Portugal",
    name: "Hipódromo Manuel Possolo",
    countryCode: "PT",
    locality: "Cascais",
    address: "Hipódromo Manuel Possolo",
    objectType: "venue",
    originalType: "amenity",
    category: "sport.sports_centre",
    confidence: 1,
  }),
];

const parkCandidates = [
  candidate({
    latitude: 38.6929693,
    longitude: -9.4229258,
    placeId:
      "51ef44ffba89d822c059e650d037b3584340f00102f9012285060600000000c00201920317506172717565204d6172656368616c204361726d6f6e61",
    label: "Parque Marechal Carmona, Cascais, Lisbon, Portugal",
    name: "Parque Marechal Carmona",
    countryCode: "PT",
    locality: "Cascais",
    address: "Parque Marechal Carmona",
    objectType: "venue",
    originalType: "amenity",
    category: "leisure.park",
    confidence: 1,
  }),
];

const cascaisCandidates = [
  candidate({
    latitude: 38.6968919,
    longitude: -9.4204495,
    placeId:
      "51363d282845d722c05974acf7c033594340f00101f9013969520000000000c0020892030743617363616973",
    label: "Cascais, Portugal",
    name: "Cascais",
    countryCode: "PT",
    locality: "Cascais",
    address: "Cascais",
    objectType: "locality",
    originalType: "city",
    category: "administrative",
    confidence: 1,
  }),
];

export const locationSeveralVenuesCase: LocationCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: {
    id: "location-several-venues",
    suite: "regression",
    origin: "synthetic",
    task: "Check location several venues",
    provenance: {
      kind: "captured-adapted",
      note: "Saved descriptions, source summaries and Geoapify forward responses captured on 2026-10-24. Free-text replay hints use those captured responses. Responses use the client format and omit unused provider fields. Reverse was not captured and is explicitly unavailable. Expected actions are review assertions, not captured model output.",
    },
    input: refreshInput(eventId),
    location: {
      group: "completion",
      input: locationInput(
        newTarget({
          editionKey,
          editionYear: 2027,
          startsOn: "2027-07-01",
          endsOn: "2027-07-31",
          scheduleStatus: "scheduled",
        }),
        {
          festival: {
            name: "Ageas Cooljazz",
            summary:
              "Ageas Cooljazz is a recurring summer music festival in Cascais, with performances at Hipódromo Manuel Possolo and Parque Marechal Carmona.",
            format: ["openair"],
          },
          countryBaseline: "PT",
          sources: [
            {
              url: "https://www.ageascooljazz.pt/",
              information:
                "Official Ageas Cooljazz homepage identifies the festival, gives the 1–31 July 2027 dates in Cascais, and links official YouTube, Facebook, Instagram and TikTok accounts.",
            },
            {
              url: "https://www.ageascooljazz.pt/recinto.html",
              information:
                "Official venue page says Ageas Cooljazz uses Hipódromo Manuel Possolo and Parque Marechal Carmona, both in central Cascais.",
            },
            {
              url: "https://www.ageascooljazz.pt/en/line-up.html",
              information:
                "Official lineup page identifies 2027 performers and describes music programming including jazz, indie-pop and other sounds; it lists a 15 July Jack Johnson ticket link.",
            },
            {
              url: "https://cooljazz.seetickets.com/event/jack-johnson-ageas-cooljazz-2027/hipodromo-manuel-possolo-cascais/3743124?src=#op1",
              information:
                "Official ticketing page identifies the Jack Johnson Ageas Cooljazz 2027 show at Hipódromo Manuel Possolo, Cascais, on 15 July. It lists general ticket prices and availability; prices include a €2 donation.",
            },
          ],
          evidence: [
            locationEvidence(
              editionKey,
              1,
              'venueName: "Hipódromo Manuel Possolo and Parque Marechal Carmona"',
            ),
            locationEvidence(editionKey, 2, 'locality: "Cascais"'),
            locationEvidence(editionKey, 3, 'countryCode: "PT"'),
          ],
        },
      ),
    },
    geocoding: [
      forward(
        "Hipódromo Manuel Possolo and Parque Marechal Carmona, Cascais, PT",
        "PT",
        [
          candidate({
            latitude: 38.6968919,
            longitude: -9.4204495,
            placeId:
              "51363d282845d722c05974acf7c033594340f00101f9013969520000000000c0020892030743617363616973",
            label: "Cascais, Portugal",
            countryCode: "PT",
            objectType: "locality",
            originalType: "city",
            confidence: 0.25,
          }),
        ],
      ),
      forward(
        "Hipódromo Manuel Possolo, Cascais, PT",
        "PT",
        hippodromeCandidates,
      ),
      forward("Hipódromo Manuel Possolo", "PT", hippodromeCandidates),
      forward("Parque Marechal Carmona, Cascais, PT", "PT", parkCandidates),
      forward("Parque Marechal Carmona", "PT", parkCandidates),
      forward("Cascais, PT", "PT", cascaisCandidates),
      forward("Cascais", "PT", cascaisCandidates),
      forward(
        "Cascais, Lisbon District, Portugal",
        "PT",
        cascaisCandidates,
        "Synthetic alias for the same locality query with its administrative area and country name. It reuses the captured locality response and does not establish a venue point.",
      ),
      forward(
        "Cascais, Portugal",
        "PT",
        cascaisCandidates,
        "Synthetic alias for the same locality query with the country name instead of its code. It reuses the captured Cascais locality response and does not establish a venue point.",
      ),
    ],
    sources: [],
  },
  evaluate: ({ edition }) => {
    const target = edition("ageas-cooljazz-2027");
    return [
      pointQuestion(target),
      pointChanged(target, {
        latitude: 38.6968919,
        longitude: -9.4204495,
        precision: "locality",
      }),
      replacePoint(target),
    ];
  },
};
