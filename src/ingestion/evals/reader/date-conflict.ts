import { evidenceRequirement as evidence } from "./checks";

export const dateConflictReader = {
  id: "reader-date-correction",
  sourceCaseId: "search-date-conflict",
  sourceUrl: "https://castlewellangrounds.co.uk/events/harbor-echo-2027",
  requirements: [
    evidence("identity", "identity", "Harbor Echo"),
    evidence(
      "dates-with-correction",
      "dates",
      "23–30 January 2027",
      "This independently confirms the organiser's January programme dates.",
      "The festival is NOT booked for 1–3 February 2027; that headline is incorrect.",
    ),
    evidence(
      "venue-address",
      "location",
      "Castlewellan Grounds",
      "Festival Lane, Castlewellan, Northern Ireland, United Kingdom",
    ),
    evidence(
      "free-admission-conditions",
      "tickets",
      "free full-programme admission and no booking required",
      "23–30 January 2027",
    ),
    evidence(
      "official-organiser-link",
      "links",
      "https://harborechofestival.co.uk/",
    ),
    evidence("outdoor-music", "classification", "outdoor music festival"),
  ],
};
