import type { LocationCaseDefinition } from "../../location";
import type { LocationTarget } from "../../../roles/location/input";
import { preservePoint } from "./assertions";
import { locationInput, savedTarget, locationEvidence } from "./fixture";
import { candidate, forward, geocodingUnavailable } from "../geocoding";
import { refreshInput } from "../fixture";

const editionKey = "2027";
const eventId = "event:b4753a47250461a2704a";
const savedEdition: NonNullable<LocationTarget["saved"]> = {
  venueName: "Parque del Sotillo",
  venueAddress: null,
  locality: "Palencia",
  administrativeArea: "Castilla y León",
  countryCode: "ES",
  id: "af7f9e5d-fb71-4737-a87b-86ec5cb65764",
  eventId,
  editionKey,
  version: 4,
  editionYear: 2027,
  startsOn: "2027-06-11",
  endsOn: "2027-06-12",
  scheduleStatus: "scheduled",
  latitude: 42.0093,
  longitude: -4.5253,
  coordinatePrecision: "approximate",
};

const parkCandidates = [
  candidate({
    latitude: 42.0108856,
    longitude: -4.5328735,
    placeId:
      "51c79e3d97a92112c059a9ff07b364014540f00103f9016490540e00000000c0020892030850616c656e636961",
    label: "Palencia, CL, Spain",
    name: "Palencia",
    countryCode: "ES",
    locality: "Palencia",
    address: "Palencia",
    objectType: "locality",
    originalType: "city",
    category: "populated_place",
    confidence: 0.25,
  }),
  candidate({
    latitude: 41.050546,
    longitude: -5.195461,
    placeId:
      "51e692aaed26c814c059c878944a78864440c0020492030f5061727175652064656c2052c3ad6fe203266f70656e7374726565746d61703a7374726565743a706f6c796c696e653a3134303237323537",
    label: "Parque del Río, 37406 Palaciosrubios, Spain",
    name: "Parque del Río",
    countryCode: "ES",
    locality: "Palaciosrubios",
    address: "Parque del Río",
    objectType: "unknown",
    originalType: "street",
    confidence: 0,
  }),
  candidate({
    latitude: 40.932894,
    longitude: -4.09862,
    placeId:
      "5114ed2aa4fc6410c0593b51121269774440c002049203105061727175652064656c2052656c6f6ae203266f70656e7374726565746d61703a7374726565743a706f6c796c696e653a3134333032393234",
    label: "Parque del Reloj, 40006 Segovia, Spain",
    name: "Parque del Reloj",
    countryCode: "ES",
    locality: "Segovia",
    address: "Parque del Reloj",
    objectType: "unknown",
    originalType: "street",
    confidence: 0,
  }),
];

const palenciaCandidates = [
  candidate({
    latitude: 42.0108856,
    longitude: -4.5328735,
    placeId:
      "51c79e3d97a92112c059a9ff07b364014540f00103f9016490540e00000000c0020892030850616c656e636961",
    label: "Palencia, CL, Spain",
    name: "Palencia",
    countryCode: "ES",
    locality: "Palencia",
    address: "Palencia",
    objectType: "locality",
    originalType: "city",
    category: "populated_place",
    confidence: 1,
  }),
];

export const locationCentralParkCase: LocationCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: {
    id: "location-central-park",
    suite: "regression",
    origin: "synthetic",
    task: "Check location central park",
    provenance: {
      kind: "captured-adapted",
      note: "Saved descriptions, source summaries and Geoapify forward responses captured on 2026-10-24. Free-text replay hints use those captured responses. Responses use the client format and omit unused provider fields. Reverse was not captured and is explicitly unavailable. Expected actions are review assertions, not captured model output.",
    },
    input: refreshInput(eventId),
    initial: {
      event: {
        id: eventId,
        slug: "location-central-park",
        canonicalName: "Palencia Sonora",
        editions: [
          {
            id: "af7f9e5d-fb71-4737-a87b-86ec5cb65764",
            editionKey,
            editionYear: 2027,
            startsOn: "2027-06-11",
            endsOn: "2027-06-12",
            scheduleStatus: "scheduled",
            latitude: 42.0093,
            longitude: -4.5253,
            coordinatePrecision: "approximate",
            venueName: "Parque del Sotillo",
            venueAddress: null,
            locality: "Palencia",
            administrativeArea: "Castilla y León",
            countryCode: "ES",
          },
        ],
      },
    },
    location: {
      group: "preservation",
      input: locationInput(savedTarget(savedEdition), {
        festival: {
          name: "Palencia Sonora",
          summary:
            "Recurring music festival in Palencia, with live concerts and DJ programming, including performances at Parque del Sotillo and across city locations.",
          format: ["openair"],
        },
        countryBaseline: "ES",
        sources: [
          {
            url: "https://www.palenciasonora.com/",
            information:
              "Official festival homepage identifies the XXIV edition on 11–12 June 2027, names Parque del Sotillo and Palencia, describes the festival’s music and pop-rock identity, and links official social accounts and ticket information. The saved non-www address redirects here.",
          },
          {
            url: "https://www.palenciasonora.com/palencia-sonora-reunira-la-musica-en-vivo-de-42-artistas-y-grupos-en-una-edicion-de-record-que-suma-nuevas-actividades-paralelas/",
            information:
              "Official 25 May 2026 programme describes the XXIII edition, 11–14 June, main concerts at Parque del Sotillo and other Palencia locations, 42 musical acts and DJ programming.",
          },
          {
            url: "https://www.palenciasonora.com/palencia-sonora-agota-en-tiempo-record-los-abonos-para-la-edicion-de-2027/",
            information:
              "Official 17 June 2026 article confirms 2027 dates as 11–12 June and reports that the 2026 edition had again exceeded 20,000 spectators, establishing it had taken place.",
          },
          {
            url: "https://www.palenciasonora.com/entradas/",
            information:
              "Official 2027 ticket page labels the passes sold out and links the festival’s ticket checkout; no ticket price is shown on the inspected page.",
          },
          {
            url: "https://www.palenciasonora.com/cartel-por-dias-palencia-sonora-2026/",
            information:
              "Official day-by-day programme for the 2026 XXIII edition gives its 11–14 June programme and describes live music, DJs and the main Parque del Sotillo site.",
          },
          {
            url: "https://www.palenciasonora.com/cartel-palencia-sonora-2026/",
            information:
              "Official 2026 lineup release characterizes the festival’s music as including pop-rock and indie artists, alongside a DJ programme.",
          },
        ],
        evidence: [
          locationEvidence(editionKey, 1, 'venueName: "Parque del Sotillo"'),
          locationEvidence(editionKey, 2, 'locality: "Palencia"'),
          locationEvidence(
            editionKey,
            3,
            'administrativeArea: "Castilla y León"',
          ),
          locationEvidence(editionKey, 4, 'countryCode: "ES"'),
        ],
      }),
    },
    geocoding: [
      forward("Parque del Sotillo, Palencia, Castilla y León, ES", "ES", [
        candidate({
          latitude: 40.605688,
          longitude: -4.329893,
          placeId:
            "51a2b77878cf5111c05932ca332f874d4440c00204920315547261766573c3ad612064656c20536f74696c6c6fe203266f70656e7374726565746d61703a7374726565743a706f6c796c696e653a3134353739323538",
          label: "Travesía del Sotillo, 05230 Las Navas, Spain",
          countryCode: "ES",
          objectType: "unknown",
          originalType: "street",
          confidence: 0,
        }),
      ]),
      forward("Parque del Sotillo, Palencia, ES", "ES", parkCandidates),
      forward("Parque del Sotillo", "ES", parkCandidates),
      forward("Palencia, ES", "ES", palenciaCandidates),
      forward("Palencia", "ES", palenciaCandidates),
      geocodingUnavailable({
        direction: "reverse",
        latitude: 42.0093,
        longitude: -4.5253,
      }),
    ],
    sources: [],
  },
  evaluate: ({ edition }) => preservePoint(edition("2027")),
};
