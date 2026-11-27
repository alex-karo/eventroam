import { check } from "../../checks";
import { researchDidNotFail } from "../../research";
import type { RegressionCaseDefinition } from "../../regression";
import { sourceReplay } from "../fixture";
import { candidate, forward } from "../geocoding";

const eventName = "Fête des vins de Bandol";
const website = "https://fete-des-vinsdebandol.fr/";
const officialPage = "https://www.fete-des-vinsdebandol.fr/";
const geocodingProvenance =
  "Normalized Geoapify replies captured in the production Location trace on 2026-11-26.";

export const bandolAddCase = {
  fixture: {
    id: "bandol-wine-add",
    suite: "regression",
    origin: "captured",
    todayUtc: "2026-11-26",
    task: "Add Fête des vins de Bandol from one official page",
    input: {
      mode: "add",
      input: `${eventName}\nWebsite: ${website}`,
      actor: "catalog-research",
      initiatedBy: "eval",
      dryRun: true,
    },
    initial: {
      event: {
        id: "eval-control-event",
        slug: "eval-control-event",
        canonicalName: "Control Festival",
        editions: [],
      },
    },
    sources: [
      sourceReplay(website, "2026-11-26T20:25:19.718Z", "page.md", {
        finalUrl: officialPage,
      }),
    ],
    geocoding: [
      forward(
        "Quai du port, 83150 Bandol, France",
        "FR",
        [
          candidate({
            latitude: 43.1351305,
            longitude: 5.7582947,
            placeId:
              "51a8ebe4677e081740599818cbf44b914540f00102f9016a0f2c0d00000000c0020492030c5175616920647520506f7274",
            label: "Quai du Port, 83150 Bandol, France",
            name: "Quai du Port",
            countryCode: "FR",
            locality: "Bandol",
            address: "Quai du Port",
            objectType: "unknown",
            originalType: "street",
            confidence: 1,
          }),
        ],
        geocodingProvenance,
      ),
      forward(
        "Bandol, France",
        "FR",
        [
          candidate({
            latitude: 43.1357717,
            longitude: 5.7523647,
            placeId:
              "51cfa854e46b02174059759c91f760914540f00101f901485c120000000000c0020892030642616e646f6c",
            label: "Bandol, PAC, France",
            name: "Bandol",
            countryCode: "FR",
            locality: "Bandol",
            address: "Bandol",
            objectType: "locality",
            originalType: "city",
            category: "administrative",
            confidence: 1,
          }),
        ],
        geocodingProvenance,
      ),
    ],
    provenance: {
      kind: "captured-official-page",
      note: "The excerpt uses the official homepage captured on 2026-11-26. Navigation and unrelated content are omitted. The add note and unrelated catalog seed are synthetic. No Bandol record exists before the dry run.",
    },
  },
  moduleUrl: import.meta.url,
  evaluate: ({ item, report }) => {
    const events = report.operations.filter((op) => op.kind === "createEvent");
    const editions = report.operations.filter(
      (op) => op.kind === "createEdition",
    );
    const [event] = events;
    const [edition] = editions;
    const eventId = event?.tempKey && report.references[event.tempKey];
    const editionId = edition?.tempKey && report.references[edition.tempKey];
    const editionRef = edition?.tempKey && `$${edition.tempKey}`;
    const terms = report.operations.find(
      (op) => op.kind === "replaceTerms" && op.id === editionRef,
    );
    const termIds = terms?.kind === "replaceTerms" ? terms.termIds : [];

    return [
      ...researchDidNotFail(report),
      check("research.editor", report.editorStatus === "success"),
      check(
        "sources.officialPage",
        report.sources.some(
          (source) =>
            source.finalUrl === officialPage && source.outcome === "ok",
        ),
      ),
      check(
        "catalog.event.identity",
        events.length === 1 &&
          !!eventId &&
          report.eventId === eventId &&
          eventId !== item.initial.event.id &&
          /^(la )?fête des vins de bandol$/iu.test(event.data.canonicalName),
      ),
      check(
        "catalog.edition.identity",
        editions.length === 1 &&
          !!event?.tempKey &&
          !!editionId &&
          edition.eventId === `$${event.tempKey}` &&
          edition.data.editionYear === 2026,
      ),
      check(
        "catalog.edition.dates",
        edition?.data.startsOn === "2026-12-05" &&
          edition.data.endsOn === "2026-12-06" &&
          edition.data.dateState === "confirmed",
      ),
      check("catalog.edition.country", edition?.data.countryCode === "FR"),
      check(
        "catalog.edition.festival",
        termIds.includes("validation:festival"),
      ),
      check(
        "catalog.edition.wine",
        termIds.includes("catalog:term:topic:wine"),
      ),
      check(
        "catalog.edition.noFoodAndDrink",
        !termIds.includes("validation:topic:food-and-drink"),
        "The wine programme and food vendors do not establish a separate culinary programme",
      ),
      check(
        "catalog.edition.published",
        report.mode === "add" &&
          report.outcome === "published" &&
          !!editionId &&
          report.operations.some(
            (op, index) =>
              op.kind === "publishEdition" &&
              op.id === editionRef &&
              report.receipts[index]?.id === editionId &&
              report.receipts[index]?.changed,
          ),
      ),
    ];
  },
} satisfies RegressionCaseDefinition;
