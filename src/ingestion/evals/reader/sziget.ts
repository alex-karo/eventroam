import { evidenceRequirement as evidence } from "./checks";

export const szigetReader = {
  id: "reader-sziget-homepage",
  sourceCaseId: "sziget",
  sourceUrl: "https://szigetfestival.com/en/",
  requirements: [
    evidence("identity", "identity", "Sziget"),
    evidence("programme-dates", "dates", "2027 10 - 14 AUG"),
    evidence(
      "full-pass-and-fee",
      "tickets",
      "5-day Pass",
      "€ 349",
      "+handling fee € 23",
      "2027",
    ),
    evidence(
      "youth-pass-and-fee",
      "tickets",
      "21&Under 5-day Pass",
      "€ 279",
      "handling fee € 18",
      "2027",
    ),
    evidence(
      "vip-pass-and-fee",
      "tickets",
      "VIP 5-day Pass",
      "€ 569",
      "handling fee € 37",
      "2027",
    ),
    evidence(
      "completed-festival-context",
      "status",
      "BEST MOMENTS OF 2026",
      "we just lived the time of our lives",
    ),
    evidence(
      "ticket-overview",
      "links",
      "https://szigetfestival.com/en/tickets",
    ),
    evidence(
      "official-instagram",
      "links",
      "https://instagram.com/szigetofficial/",
    ),
  ],
};
