import type { LocationCaseDefinition } from "../../location";
import type { LocationTarget } from "../../../roles/location/input";
import { pointChanged, pointQuestion, replacePoint } from "./assertions";
import { locationInput, savedTarget, locationEvidence } from "./fixture";
import { forward, geocodingUnavailable } from "../geocoding";
import { refreshInput } from "../fixture";
import {
  cemeteryCandidates,
  venueQueryCandidates,
  portasCandidates,
} from "./portas-replay";

const editionKey = "2027";
const eventId = "event:7c4bee6a0db9e3b8f696";
const savedEdition: NonNullable<LocationTarget["saved"]> = {
  venueName: "Azucreira de Portas",
  venueAddress: null,
  locality: "Portas",
  administrativeArea: "Pontevedra",
  countryCode: "ES",
  id: "f9a70691-9caf-4e81-9de8-fcdad0218541",
  eventId,
  editionKey,
  version: 5,
  editionYear: 2027,
  startsOn: "2027-07-08",
  endsOn: "2027-07-10",
  scheduleStatus: "scheduled",
  latitude: 42.579634,
  longitude: -8.669209,
  coordinatePrecision: "exact",
};

export const locationCemeteryCorrectionCase: LocationCaseDefinition = {
  moduleUrl: import.meta.url,
  fixture: {
    id: "location-cemetery-correction",
    suite: "regression",
    origin: "synthetic",
    task: "Check location cemetery correction",
    provenance: {
      kind: "captured-adapted",
      note: "Saved descriptions, source summaries and Geoapify forward responses captured on 2026-10-24. Free-text replay hints use those captured responses. Responses use the client format and omit unused provider fields. Reverse was not captured and is explicitly unavailable. Expected actions are review assertions, not captured model output. The locality refinement with administrative area was captured in the 2026-10-26 PortAmérica v6 ingestion run. The added correction notice is synthetic: it states that the saved 2027 point is a cemetery mapping error. This notice was not captured from PortAmérica or the provider.",
    },
    input: refreshInput(eventId),
    location: {
      group: "correction",
      input: locationInput(savedTarget(savedEdition), {
        festival: {
          name: "PortAmérica",
          summary:
            "A recurring Galician festival combining live music, gastronomy and community, with additional cultural programming.",
          format: ["openair"],
        },
        countryBaseline: "ES",
        sources: [
          {
            url: "https://location-fixture.example/portamerica-2027-mapping-correction",
            information:
              "Synthetic correction notice for this eval: the saved 2027 point identifies Cemiterio de Portas, not the Azucreira de Portas festival venue. This is an established mapping error, not an inference from a nearby reverse result. No replacement venue point is supplied.",
          },
          {
            url: "https://portamerica.es/",
            information:
              "Official PortAmérica site; the saved www/http address redirects to this canonical HTTPS site. It identifies the festival with the Azucarera de Portas and links official social accounts.",
          },
          {
            url: "https://portamerica.es/comollegar/",
            information:
              "Official location and travel page: the festival is held near the historic Azucarera de Portas and describes music and gastronomy outdoors.",
          },
          {
            url: "https://portamerica.es/portamerica-despide-su-xiv-edicion-y-pone-rumbo-a/",
            information:
              "Official 17 July 2026 recap says the XIV edition has closed after three days at Azucreira de Portas; describes its music, chef-led ShowRocking, other cultural programming, and sustainability and inclusion activities.",
          },
          {
            url: "https://portamerica.es/consulta-los-horarios-de-portamerica-2026/",
            information:
              "Official 2026 programme announcement gives the XIV edition dates as 9–11 July in Portas and lists its music programme.",
          },
          {
            url: "https://portamerica.es/portamerica-pone-a-la-venta-los-abonos-creyentes-de-su-xv-aniversario-que-sera-los-dias-8-9-y-10-de-julio/",
            information:
              "Official 28 July 2026 announcement confirms PortAmérica’s XV Anniversary dates, 8–10 July 2027, at Azucreira de Portas; says the festival unites music, gastronomy and community, and reports the first abonos from €70 with €15 bar credit.",
          },
          {
            url: "https://portamerica.es/portamerica-agota-los-abonos-promo-creyentes-para-s/",
            information:
              "Official 3 August 2026 report confirms the 2027 dates and venue and says the limited Promo Creyentes abono allotment from €70, including €15 bar credit, sold out.",
          },
          {
            url: "https://portamerica.es/abonos-y-entradas/",
            information:
              "Official ticket page provides the PortAmérica 2027 ticket route. It confirms ticketing but does not give a current general-admission price.",
          },
        ],
        evidence: [
          locationEvidence(
            editionKey,
            "mapping-error",
            "The saved 2027 point at (42.579634, -8.669209) is an old mapping error. It identifies Cemiterio de Portas. The 2027 festival venue is Azucreira de Portas, a different site in Portas, Pontevedra, Spain. The festival does not take place at the cemetery. The exact venue point has not been established.",
            [
              "Synthetic correction notice for the 2027 Edition. This states a known mapping error; it is not a nearby reverse-geocoding result.",
            ],
            "synthetic-mapping-correction",
          ),
          locationEvidence(editionKey, 1, 'venueName: "Azucreira de Portas"'),
          locationEvidence(editionKey, 2, 'locality: "Portas"'),
          locationEvidence(editionKey, 3, 'administrativeArea: "Pontevedra"'),
          locationEvidence(editionKey, 4, 'countryCode: "ES"'),
        ],
      }),
    },
    geocoding: [
      forward(
        "Azucreira de Portas, Portas, Pontevedra, ES",
        "ES",
        cemeteryCandidates,
      ),
      forward("Azucreira de Portas, Portas, ES", "ES", venueQueryCandidates),
      forward("Azucreira de Portas", "ES", venueQueryCandidates),
      forward("Portas, ES", "ES", portasCandidates),
      forward("Portas", "ES", portasCandidates),
      geocodingUnavailable({
        direction: "reverse",
        latitude: 42.579634,
        longitude: -8.669209,
      }),
      forward("Portas, Pontevedra, Spain", "ES", portasCandidates),
      forward(
        "Azucarera de Portas, Portas, Pontevedra, Spain",
        "ES",
        cemeteryCandidates,
        "Synthetic query alias for the Azucarera spelling in the supplied official source summaries. Reuses the captured Azucreira venue-query response; this alias was not captured from the provider. It retains the unrelated cemetery candidate.",
      ),
      forward(
        "Azucarera de Portas, Portas, Pontevedra",
        "ES",
        cemeteryCandidates,
        "Synthetic alias for the observed query without Spain, with countryCode ES. Reuses the captured Azucreira venue-query response; this alias was not captured from the provider. It retains the unrelated cemetery candidate.",
      ),
    ],
    sources: [],
  },
  evaluate: ({ edition }) => {
    const target = edition("2027");
    return [
      pointQuestion(target),
      pointChanged(target, {
        latitude: 42.5639366,
        longitude: -8.6570848,
        precision: "locality",
      }),
      replacePoint(target),
    ];
  },
};
