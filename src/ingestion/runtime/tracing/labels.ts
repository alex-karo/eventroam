import type { CatalogItemResult } from "@/catalog/write/apply-operation";
import type {
  CatalogResearchInput,
  CatalogResearchResult,
} from "../../contracts";
import type { ResearchCatalog, PreparedResearch } from "../../research/prepare";

/** A single byte limit, without splitting a Unicode code point. */
export function traceText(value: string, bytes: number) {
  const singleLine = value.replace(/[\u0000-\u001f\u007f]/g, " ");
  if (Buffer.byteLength(singleLine) <= bytes) {
    return singleLine;
  }
  let result = "";
  for (const char of singleLine) {
    if (Buffer.byteLength(result + char + "…") > bytes) {
      break;
    }
    result += char;
  }
  return result + "…";
}
export function traceUrl(value: string) {
  return {
    url: traceText(value, 512),
    truncated: Buffer.byteLength(value) > 512,
  };
}
export type TraceEdition = {
  occurrenceId?: string;
  editionKey: string;
  year: number | null;
  role?: "created" | "updated";
};
export function boundedEditions(editions: TraceEdition[]) {
  return {
    entries: editions.slice(0, 10).map((edition) => ({
      ...(edition.occurrenceId
        ? { occurrenceId: traceText(edition.occurrenceId, 160) }
        : {}),
      editionKey: traceText(edition.editionKey, 160),
      year: edition.year,
      ...(edition.role ? { role: edition.role } : {}),
    })),
    omitted: Math.max(0, editions.length - 10),
  };
}
export function contextEditions(
  catalog: ResearchCatalog,
  eventId?: string,
): TraceEdition[] {
  return (
    catalog
      .find((event) => event.id === eventId)
      ?.editions.map((edition) => ({
        occurrenceId: edition.id,
        editionKey: edition.occurrenceKey,
        year: edition.occurrenceYear,
      })) ?? []
  );
}
/** Merge confirmed writer changes with the original snapshot; never infer a year. */
export function committedEditions(
  applied: CatalogItemResult | null,
  catalog: ResearchCatalog,
): TraceEdition[] {
  if (!applied) {
    return [];
  }
  const editions = new Map(
    catalog.flatMap((event) =>
      event.editions.map(
        (edition) =>
          [
            edition.id,
            {
              occurrenceId: edition.id,
              editionKey: edition.occurrenceKey,
              year: edition.occurrenceYear,
            },
          ] as const,
      ),
    ),
  );
  const touched = new Map<string, TraceEdition>();
  for (const change of applied.changes) {
    const id = change.occurrenceId;
    if (!id) {
      continue;
    }
    const prior = touched.get(id) ??
      editions.get(id) ?? { occurrenceId: id, editionKey: "?", year: null };
    const entry: TraceEdition = {
      ...prior,
      role: editions.has(id) ? "updated" : "created",
    };
    for (const field of change.changedFields) {
      if (
        field.field === "occurrence_key" &&
        typeof field.newValue === "string"
      ) {
        entry.editionKey = field.newValue;
      }
      if (field.field === "occurrence_year") {
        entry.year = typeof field.newValue === "number" ? field.newValue : null;
      }
    }
    touched.set(id, entry);
  }
  return [...touched.values()];
}
function editionLabel(edition: TraceEdition) {
  const year = edition.year ?? "?";
  return String(year) === edition.editionKey
    ? String(year)
    : `${year} [key:${edition.editionKey}]`;
}
export function runTraceLabel(
  name: string,
  mode: CatalogResearchInput["mode"],
  context: TraceEdition[],
  mutations: TraceEdition[],
  result?: string,
) {
  const roleLabel = (role: string, entries: TraceEdition[]) => {
    if (!entries.length) {
      return [];
    }
    const overflow = entries.length > 1 ? " +" + (entries.length - 1) : "";
    return [role + ":" + traceText(editionLabel(entries[0]), 64) + overflow];
  };
  const roles = [
    ...roleLabel("ctx", context),
    ...(["created", "updated"] as const).flatMap((role) =>
      roleLabel(
        role,
        mutations.filter((edition) => edition.role === role),
      ),
    ),
  ];
  const suffix = " · " + mode + (result ? " · " + result : "");
  const details = traceText(roles.join(" · "), 240);
  const tail = (details ? " · " + details : "") + suffix;
  return traceText(name, Math.min(320, 512 - Buffer.byteLength(tail))) + tail;
}
export type TraceWriteState =
  "committed" | "rolled_back" | "unchanged" | "not_attempted" | "unknown";
export type TraceRunState = {
  structuralValidation: "passed" | "failed" | "not_run";
  targetValidation: "passed" | "failed" | "not_run";
  writeState: TraceWriteState;
  errorCode?:
    | "validation_failed"
    | "research_failed"
    | "write_failed"
    | "context_failed"
    | "report_failed"
    | "workflow_failed";
};
export function traceResultLabel(
  state: TraceRunState,
  report?: CatalogResearchResult,
) {
  if (state.errorCode === "report_failed") {
    return "report-failed";
  }
  if (state.errorCode === "write_failed") {
    return "write-failed";
  }
  if (state.errorCode === "validation_failed") {
    return "invalid";
  }
  if (state.errorCode) {
    return "failed";
  }
  return report?.researchStatus === "partial"
    ? "partial"
    : (report?.outcome ?? report?.researchStatus);
}
export function validatedTraceName(
  input: CatalogResearchInput,
  catalog: ResearchCatalog,
  prepared: PreparedResearch | null,
) {
  const event = catalog.find(
    (entry) => entry.id === (input.eventId ?? prepared?.matchedEventId),
  );
  return (
    event?.canonicalName ??
    prepared?.candidate?.data?.eventName ??
    input.name ??
    input.eventId ??
    "Festival"
  );
}
const reasons = new Set([
  "request_failed",
  "oversized_response",
  "invalid_url",
  "social_content_unsupported",
  "unsupported_media_type",
  "source_content_truncated",
  "javascript_required",
  "unsafe_url",
  "unsafe_address",
  "redirect_limit",
  "redirect_missing_location",
  "request_timeout",
  "timeout",
  "redirect_without_location",
  "firecrawl_failed",
  "firecrawl_unavailable",
  "firecrawl_invalid_response",
]);
export function traceReason(reason?: string) {
  return reason &&
    (reasons.has(reason) ||
      /^(?:firecrawl_)?http_[1-5]\d\d$/.test(reason) ||
      /^(time|pages|depth|searches|modelCalls|modelInputChars)_budget_exhausted$/.test(
        reason,
      ))
    ? traceText(reason, 64)
    : "unknown";
}
