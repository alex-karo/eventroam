import type { CatalogResearchInput } from "../../contracts";
import { requireSupport, type FrozenCorpus } from "../../evidence/contracts";
import { editionSlotNames } from "../../research/contracts";
import type { ResearchContext } from "../../research/context";
import {
  initialDiagnostics,
  rejectProposal,
  type PlanDiagnostics,
  type StageResult,
} from "../../stage";
import { hasEventFieldCheck } from "../assignment";
import type { GeneralOutput, Targets } from "./contracts";

type SavedEvent = ResearchContext["catalog"][number];
export function checkRefreshCountries(
  output: GeneralOutput,
  mode: CatalogResearchInput["mode"],
  event: SavedEvent | undefined,
  corpus: FrozenCorpus,
) {
  if (
    mode !== "refresh" ||
    !("festivalCountries" in output) ||
    !output.festivalCountries?.length
  ) {
    return;
  }
  const diagnostics = initialDiagnostics();
  if (output.decision === "uncertain") {
    diagnostics.unresolved = output.unresolved;
  }
  for (const { countryCode, evidenceIds } of output.festivalCountries) {
    try {
      requireSupport(evidenceIds, corpus);
    } catch {
      return rejectProposal(
        diagnostics,
        "Festival country needs inspected source support",
      );
    }
    const saved = event?.editions.find(
      (edition) =>
        edition.countryCode &&
        edition.countryCode.toUpperCase() !== countryCode,
    );
    if (saved) {
      const evidence = corpus.evidence.find(
        (item) => item.id === evidenceIds[0],
      );
      const source = corpus.sources.find(
        (item) => item.id === evidence?.sourceId,
      );
      return rejectProposal(
        diagnostics,
        `Sources place the festival in ${countryCode}, but saved Edition ${saved.editionKey} has country ${saved.countryCode}. Confirm the saved country and correct it separately before retrying.`,
        "country_conflict",
        source?.finalUrl,
      );
    }
  }
}

function duplicateSupported(
  event: SavedEvent,
  ids: string[],
  corpus: FrozenCorpus,
) {
  const support = corpus.evidence.filter((item) => ids.includes(item.id));
  const name = event.canonicalName.trim().toLocaleLowerCase();
  if (support.some((item) => item.quote.toLocaleLowerCase().includes(name))) {
    return true;
  }
  const hosts = event.links
    .filter((link) => link.kind === "official_site")
    .map((link) => new URL(link.url).hostname.replace(/^www\./, ""));
  return support.some((item) => {
    const source = corpus.sources.find((source) => source.id === item.sourceId);
    return (
      !!source &&
      hosts.includes(new URL(source.finalUrl).hostname.replace(/^www\./, ""))
    );
  });
}
function validateTemporalTargets(
  output: Targets,
  event: SavedEvent | undefined,
  currentDate: string,
  corpus: FrozenCorpus,
) {
  for (const slot of editionSlotNames) {
    const target = output[slot];
    if (!target) {
      continue;
    }
    requireSupport(target.evidenceIds, corpus);
    const saved = event?.editions.find(
      (edition) => edition.editionKey === target.editionKey,
    );
    const dates = target.fields.dates;
    const selectedDates = dates?.action === "set" ? dates.value : saved;
    const startsOn = dates?.action === "clear" ? null : selectedDates?.startsOn;
    const endsOn = dates?.action === "clear" ? null : selectedDates?.endsOn;
    const day = saved?.timeZone
      ? new Intl.DateTimeFormat("en-CA", {
          timeZone: saved.timeZone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(currentDate))
      : currentDate.slice(0, 10);
    if (slot === "previousEdition" && endsOn && endsOn >= day) {
      throw new Error("Previous Edition has not completed");
    }
    if (slot === "currentOrNextEdition" && endsOn && endsOn < day) {
      throw new Error("Current or next Edition has ended");
    }
    if (startsOn && endsOn && startsOn > endsOn) {
      throw new Error("Invalid target dates");
    }
  }
}

function validateTargetAssignment(
  output: Targets,
  input: CatalogResearchInput,
) {
  if (
    input.scope === "current" &&
    (output.previousEdition || hasEventFieldCheck(output.checks))
  ) {
    throw new Error("Current refresh cannot address Event fields or history");
  }
  if (
    output.previousEdition?.editionKey ===
      output.currentOrNextEdition?.editionKey &&
    output.previousEdition
  ) {
    throw new Error("One Edition cannot occupy both roles");
  }
}
export function validateGeneral(
  output: GeneralOutput,
  context: ResearchContext,
  input: CatalogResearchInput,
  corpus: FrozenCorpus,
): StageResult<Targets & PlanDiagnostics> {
  const diagnostics = initialDiagnostics();
  const proposedEventId = "eventId" in output ? output.eventId : null;
  const event = context.catalog.find(
    ({ id }) => id === (input.eventId ?? proposedEventId),
  );
  if (proposedEventId && proposedEventId !== event?.id) {
    return rejectProposal(
      diagnostics,
      "Event is outside the assigned candidates",
    );
  }
  const countryRejection = checkRefreshCountries(
    output,
    input.mode,
    event,
    corpus,
  );
  if (countryRejection) {
    return countryRejection;
  }
  if (output.decision === "uncertain") {
    return rejectProposal(
      { ...diagnostics, unresolved: output.unresolved },
      output.reason,
    );
  }
  diagnostics.matchedEventId = event?.id;
  if (event && output.observedEventName !== event.canonicalName) {
    diagnostics.eventNameMismatch = {
      eventId: event.id,
      storedName: event.canonicalName,
      observedName: output.observedEventName,
    };
  }
  try {
    requireSupport(output.evidenceIds, corpus);
  } catch {
    return rejectProposal(
      diagnostics,
      "Identity needs inspected source support",
    );
  }
  if (output.decision === "duplicate") {
    if (input.mode !== "add" || !event) {
      return rejectProposal(diagnostics, "Invalid duplicate decision");
    }
    if (!duplicateSupported(event, output.evidenceIds, corpus)) {
      return rejectProposal(
        diagnostics,
        "Duplicate identity is not supported by the cited source",
      );
    }
    return { status: "skip", diagnostics };
  }
  if (input.mode === "add" && event) {
    return rejectProposal(
      diagnostics,
      "An existing Event requires an explicit duplicate decision",
    );
  }
  if (input.mode === "refresh" && !event) {
    return rejectProposal(diagnostics, "Refresh needs its saved Event");
  }
  try {
    validateTargetAssignment(output, input);
    validateTemporalTargets(output, event, context.currentDate, corpus);
  } catch (error) {
    return rejectProposal(
      diagnostics,
      error instanceof Error ? error.message : "Invalid temporal target",
    );
  }
  return {
    status: "continue",
    value: { ...output, ...diagnostics, unresolved: output.unresolved },
  };
}
