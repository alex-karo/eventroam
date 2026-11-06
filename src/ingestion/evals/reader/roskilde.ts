import { evidenceRequirement as evidence } from "./checks";

export const roskildeReader = {
  id: "reader-roskilde-tickets",
  sourceCaseId: "roskilde",
  sourceUrl: "https://www.roskilde-festival.dk/billetter",
  requirements: [
    evidence("identity", "general", "Roskilde Festival"),
    evidence("programme-dates", "general", "26/6 – 3/7 2027"),
    evidence(
      "full-pass",
      "tickets",
      "Alle otte dage på Roskilde Festival 2027",
      "2650",
      "kr. inkl. billetgebyr.",
    ),
    evidence(
      "two-day-pass",
      "tickets",
      "Todagesbillet",
      "2230",
      "kr. inkl. billetgebyr.",
    ),
    ...["Onsdag", "Torsdag", "Fredag", "Lørdag"].map((day) =>
      evidence(
        `${day.toLowerCase()}-day-pass`,
        "tickets",
        `Endagsbillet til ${day.toLowerCase()}`,
        "1530",
        "kr. inkl. billetgebyr.",
      ),
    ),
    evidence(
      "official-instagram",
      "links",
      "https://www.instagram.com/roskildefestival/",
    ),
  ],
};
