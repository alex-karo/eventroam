import type { EvalSuite } from "../fixtures";
import type { LocationCaseDefinition } from "../location";
import type { MainCaseDefinition } from "../main";
import type { RegressionCaseDefinition } from "../regression";
import { wackenCase } from "./wacken/case";
import { roskildeCase } from "./roskilde/case";
import { szigetCase } from "./sziget/case";
import { glastonburyCase } from "./glastonbury/case";
import { riseCase } from "./rise/case";
import { afroNationPortugalBlockedCase } from "./afro-nation-portugal/case";
import { scopeCurrentOngoingCase } from "./scope-current-ongoing/case";
import { scopeCurrentStableKeyCase } from "./scope-current-stable-key/case";
import { scopeCurrentReplacementCase } from "./scope-current-replacement/case";
import { scopeCurrentAmbiguousCase } from "./scope-current-ambiguous/case";
import { scopeFullHistoryCase } from "./scope-full-history/case";
import { scopeFullUnfinishedHistoryCase } from "./scope-full-unfinished-history/case";
import { editorWrongYearCase } from "./editor/wrong-year";
import { editorDayTicketCase } from "./editor/day-ticket";
import { editorClearCase } from "./editor/clear";
import { editorUnavailableCase } from "./editor/unavailable";
import { editorValidUpdateCase } from "./editor/valid-update";
import { editorDescriptionContextCase } from "./size-history/editor";
import { sizeEvidenceCase } from "./size-evidence/case";
import { sizeHistoricalAndUnknownCase } from "./size-history/case";
import { descriptionAnnouncedMoveCase } from "./size-history/announced-move";
import { sourceKnownOffersBlockedCheckoutCase } from "./source-regressions/known-offers";
import { sourceStaleLanguageOtherProgrammeCase } from "./source-regressions/stale-language";
import { sourceHomonymWrongSavedWebsiteCase } from "./source-regressions/homonym";
import { searchNoAnnouncementCase } from "./search-policy/no-announcement";
import { searchUnknownOfficialCase } from "./search-policy/unknown-official";
import { searchInaccessibleOfficialCase } from "./search-policy/inaccessible-official";
import { searchWrongOfficialCase } from "./search-policy/wrong-official";
import { searchDateConflictCase } from "./search-policy/date-conflict";
import { narrowCurrentStableCase } from "./narrow-current/stable";
import { narrowCurrentReuseCase } from "./narrow-current/reuse";
import { narrowCurrentChangedCase } from "./narrow-current/changed";
import { narrowCurrentNoncomparableCase } from "./narrow-current/noncomparable";
import { narrowCurrentNoneCase } from "./narrow-current/none";
import { narrowCurrentPartialTicketsCase } from "./narrow-current/partial-tickets";
import { currentIdentityContradictionCase } from "./narrow-current/identity-conflict";
import { editorRecoveredWebsiteCase } from "./editor/recovered-website";
import { editorUnknownCurrencyCase } from "./editor/unknown-currency";
import { locationCemeteryCase } from "./location/cemetery";
import { locationBridgeCase } from "./location/bridge";
import { locationCentralParkCase } from "./location/central-park";
import { locationBuildingComplexCase } from "./location/building-complex";
import { locationSeveralVenuesCase } from "./location/several-venues";
import { locationCemeteryCorrectionCase } from "./location/cemetery-correction";
import { locationMoveCityFallbackCase } from "./location/move-city-fallback";
import { locationMoveWithoutPointCase } from "./location/move-without-point";
import { locationSavedPrecisionCase } from "./location/saved-precision";
import { locationTargetBeforeDonorCase } from "./location/target-before-donor";
import { locationDonorCorrectionCase } from "./location/donor-correction";
import { locationDonorInheritanceCase } from "./location/donor-inheritance";
import { locationOfficialVenuePointCase } from "./location/official-venue-point";
import { searchConcretePlaceCase } from "./search-policy/concrete-place";
import { searchWithheldPlaceCase } from "./search-policy/withheld-place";
import { editorUncitedQualificationCase } from "./editor/uncited-qualification";
import { jazzPipelineCase, jazzEditorCase } from "./schedule-status/jazz";
import { scheduleStatusMarcoCase } from "./schedule-status/marco";
import { scheduleStatusPostponedCase } from "./schedule-status/postponed";
import { wackenAddCase } from "./wacken/add";

type CaseDefinition =
  MainCaseDefinition | RegressionCaseDefinition | LocationCaseDefinition;

export const evalCases: readonly CaseDefinition[] = [
  wackenCase,
  roskildeCase,
  szigetCase,
  glastonburyCase,
  riseCase,
  afroNationPortugalBlockedCase,
  scopeCurrentOngoingCase,
  scopeCurrentStableKeyCase,
  scopeCurrentReplacementCase,
  scopeCurrentAmbiguousCase,
  scopeFullHistoryCase,
  scopeFullUnfinishedHistoryCase,
  editorWrongYearCase,
  editorDayTicketCase,
  editorClearCase,
  editorUnavailableCase,
  editorValidUpdateCase,
  editorDescriptionContextCase,
  sizeEvidenceCase,
  sizeHistoricalAndUnknownCase,
  descriptionAnnouncedMoveCase,
  sourceKnownOffersBlockedCheckoutCase,
  sourceStaleLanguageOtherProgrammeCase,
  sourceHomonymWrongSavedWebsiteCase,
  searchNoAnnouncementCase,
  searchUnknownOfficialCase,
  searchInaccessibleOfficialCase,
  searchWrongOfficialCase,
  searchDateConflictCase,
  narrowCurrentStableCase,
  narrowCurrentReuseCase,
  narrowCurrentChangedCase,
  narrowCurrentNoncomparableCase,
  narrowCurrentNoneCase,
  narrowCurrentPartialTicketsCase,
  currentIdentityContradictionCase,
  editorRecoveredWebsiteCase,
  editorUnknownCurrencyCase,
  locationCemeteryCase,
  locationBridgeCase,
  locationCentralParkCase,
  locationBuildingComplexCase,
  locationSeveralVenuesCase,
  locationCemeteryCorrectionCase,
  locationMoveCityFallbackCase,
  locationMoveWithoutPointCase,
  locationSavedPrecisionCase,
  locationTargetBeforeDonorCase,
  locationDonorCorrectionCase,
  locationDonorInheritanceCase,
  locationOfficialVenuePointCase,
  searchConcretePlaceCase,
  searchWithheldPlaceCase,
  editorUncitedQualificationCase,
  jazzPipelineCase,
  jazzEditorCase,
  scheduleStatusMarcoCase,
  scheduleStatusPostponedCase,
  wackenAddCase,
];

const casesById = new Map(evalCases.map((item) => [item.fixture.id, item]));
if (casesById.size !== evalCases.length) {
  throw new Error("Duplicate eval case ID");
}

export function findCaseDefinition(id: string) {
  return casesById.get(id);
}

export function isLocationDefinition(
  item: CaseDefinition,
): item is LocationCaseDefinition {
  return item.fixture.location !== undefined;
}

export const evalSuiteInfo = {
  schemaVersion: 2,
  todayUtc: "2026-10-03",
  provenance: {
    kind: "captured",
    note: "Wacken, Roskilde, and Sziget use real official pages captured on 2026-10-27 with the production reader and rendering disabled. Their per-case provenance describes the current captures. Glastonbury uses synthetic pages adapted from the real site structure on 2026-10-27, with navigation and unrelated content but no confirmation of its saved 2027 programme. Archive years are navigation only. Afro Nation Portugal keeps its own 2026-10-08 blocked capture. Source timestamps, statuses and retrieval reasons are stored per response. Replay keeps links in Markdown and has no live website or search fallback. Tomorrowland remains removed because its old fixture mixed festival identities.",
  },
  terms: [
    {
      id: "catalog:term:genre:electronic",
      facet: "genre",
      slug: "electronic",
      name: "Electronic",
    },
    {
      id: "catalog:term:genre:metal",
      facet: "genre",
      slug: "metal",
      name: "Metal",
    },
    {
      id: "validation:festival",
      facet: "event_type",
      slug: "festival",
      name: "Festival",
      description:
        "The organizer presents and programmes the Edition as a festival.",
    },
    {
      id: "validation:openair",
      facet: "format",
      slug: "openair",
      name: "Open-air",
      description:
        "The main programme is primarily outdoors, even if some concerts take place on covered or enclosed stages. Open Air in the current official festival name is evidence of an open-air main programme.",
    },
    {
      id: "validation:music",
      facet: "topic",
      slug: "music",
      name: "Music",
      description:
        "Live or recorded performances form a substantial advertised programme.",
    },
    {
      id: "validation:topic:snow-sports",
      facet: "topic",
      slug: "snow-sports",
      name: "Snow sports",
      description:
        "Snow sports form a substantial programme, or an official festival package includes a ski pass valid during the Edition. A resort location or separate pass offer is insufficient.",
    },
    {
      id: "validation:topic:surfing",
      facet: "topic",
      slug: "surfing",
      name: "Surfing",
      description:
        "Surf competitions, demonstrations, lessons, or organized sessions form a substantial programme or participant offering. A seaside venue alone is insufficient.",
    },
    {
      id: "validation:topic:food-and-drink",
      facet: "topic",
      slug: "food-and-drink",
      name: "Food & drink",
      description:
        "Culinary demonstrations, chef-led sessions, cooking workshops, or tastings form a substantial programme. Ordinary food stalls, bars, or an incidental tasting are insufficient.",
    },
    {
      id: "catalog:term:topic:wine",
      facet: "topic",
      slug: "wine",
      name: "Wine",
      parentId: "validation:topic:food-and-drink",
      description:
        "An official source describes a substantial wine programme for the selected Edition, such as tastings from several wineries. A festival name, ordinary bar, sponsor mention, or incidental tasting alone is insufficient.",
    },
    {
      id: "catalog:term:topic:beer",
      facet: "topic",
      slug: "beer",
      name: "Beer",
      parentId: "validation:topic:food-and-drink",
      description:
        "An official source describes a substantial beer programme for the selected Edition, such as tastings from several breweries. A festival name, ordinary bar, sponsor mention, or incidental tasting alone is insufficient.",
    },
    {
      id: "validation:topic:outdoor",
      facet: "topic",
      slug: "outdoor",
      name: "Outdoor activities",
      description:
        "The organizer offers active outdoor recreation, such as guided hikes, climbing, or kayaking, as a substantial programme or organized participant activity. A natural setting or camping alone is insufficient.",
    },
    {
      id: "validation:mixed",
      facet: "format",
      slug: "mixed-indoor-outdoor",
      name: "Indoor and outdoor",
      description:
        "Both settings host substantial parts of the main programme and neither is clearly primary.",
    },
    {
      id: "validation:indoor",
      facet: "format",
      slug: "indoor",
      name: "Indoor",
      description:
        "Enclosed indoor spaces are the primary setting of the main programme.",
    },
  ],
} satisfies Omit<EvalSuite, "cases">;
