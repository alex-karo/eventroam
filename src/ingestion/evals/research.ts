import type { ResearchData, ResearchEdition } from "../research/contracts";
import type { Targets } from "../roles/contracts";
import type { CatalogResearchResult } from "../contracts";
import type { PipelineEvalCase } from "./fixtures";
import { contains } from "./assertions";
import { check, type Check } from "./checks";

export function researchContext(
  item: PipelineEvalCase,
  report: CatalogResearchResult,
) {
  // General owns temporal selection. Other facts are checked at their operation or Location boundary.
  const response = report.modelResponse?.object as
    { result?: Targets } | Targets | undefined;
  const raw =
    response && "result" in response
      ? response.result
      : (response as Targets | undefined);
  let data: ResearchData | null = null;
  if (raw?.decision === "targets") {
    const fact = (action: unknown) => {
      if (!action || typeof action !== "object" || !("action" in action)) {
        return undefined;
      }
      const reason = (action as unknown as { reason: string }).reason;
      if (action.action === "set") {
        return {
          value: (action as unknown as { value: unknown }).value,
          reason,
        };
      }
      if (action.action === "clear") {
        return { value: null, reason };
      }
      return undefined;
    };
    const edition = (
      slot: "previousEdition" | "currentOrNextEdition",
    ): ResearchEdition | null => {
      const target = raw[slot];
      if (!target) {
        return null;
      }
      const fields = Object.fromEntries(
        Object.entries(target.fields).flatMap(([key, value]) => {
          const finding = fact(value);
          return finding ? [[key, finding]] : [];
        }),
      );
      const creation = report.operations.find(
        (op) =>
          op.kind === "createEdition" &&
          op.data.editionKey === target.editionKey,
      );
      const saved = item.initial.event.editions.find(
        (edition) => edition.editionKey === target.editionKey,
      );
      const id = creation?.tempKey ? `$${creation.tempKey}` : saved?.id;
      const operations = report.operations.filter(
        (op) => "id" in op && op.id === id,
      );
      const terms = operations.find((op) => op.kind === "replaceTerms");
      if (terms?.kind === "replaceTerms") {
        fields.classification = {
          value: terms.termIds,
          reason: "Accepted classification",
        };
      }
      const prices = operations.find((op) => op.kind === "replacePriceBlock");
      if (prices?.kind === "replacePriceBlock") {
        fields.tickets = {
          value: { variants: prices.priceDetails, basePrice: prices.basePrice },
          reason: "Accepted ticket block",
        };
      }
      const location = report.locationResponse?.object as
        | {
            decision?: {
              status: string;
              previousEdition?: { fields: Record<string, unknown> };
              currentOrNextEdition?: { fields: Record<string, unknown> };
            };
          }
        | undefined;
      if (location?.decision?.status === "ready") {
        for (const [key, value] of Object.entries(
          location.decision[slot]?.fields ?? {},
        )) {
          const finding = fact(value);
          if (finding) {
            fields[key] = finding;
          }
        }
      }
      const links = operations.find((op) => op.kind === "replaceLinks");
      return {
        key: target.editionKey,
        ...fields,
        links: {
          ...(links?.kind === "replaceLinks" &&
          links.links.find((link) => link.kind === "ticketing")
            ? {
                tickets: links.links.find((link) => link.kind === "ticketing")!
                  .url,
              }
            : {}),
        },
      };
    };
    const eventLinks = report.operations.find(
      (op) => op.kind === "replaceLinks" && op.owner.type === "event",
    );
    const links = eventLinks?.kind === "replaceLinks" ? eventLinks.links : [];
    data = {
      eventId: raw.eventId ?? undefined,
      eventName: raw.observedEventName,
      reason: raw.reason,
      sources: report.sourceSummaries,
      summary: fact(raw.event.summary) as ResearchData["summary"],
      links: {
        website: links.find((link) => link.kind === "official_site")?.url,
        socials: Object.fromEntries(
          links
            .filter(
              (link) =>
                link.kind !== "official_site" && link.kind !== "ticketing",
            )
            .map((link) => [link.kind, link.url]),
        ),
      },
      previousEdition: edition("previousEdition"),
      currentOrNextEdition: edition("currentOrNextEdition"),
    };
  }
  const candidate = data ? { status: report.researchStatus, data } : null;
  return { item, report, candidate, data };
}

export type ResearchContext = ReturnType<typeof researchContext>;
export type ResearchEvaluator = (context: ResearchContext) => Check[];

export function researchDidNotFail(report: CatalogResearchResult) {
  return [
    check(
      "research.outcome",
      report.outcome !== "failed",
      "Catalog outcome must not be failed",
    ),
    check(
      "research.status",
      report.researchStatus !== "failed",
      "Research status must not be failed",
    ),
  ];
}

export function researchStatus(
  { report, candidate }: ResearchContext,
  status: "success" | "partial",
) {
  return check(
    "research.status",
    report.outcome !== "failed" &&
      report.researchStatus === status &&
      candidate?.status === status,
    `researchStatus=${status} with non-failed catalog outcome`,
  );
}

export function editionSlots(
  { candidate, data }: ResearchContext,
  previous: string | null,
  next: string | null,
) {
  return [
    check(
      "research.previousEdition",
      candidate !== null && (data?.previousEdition?.key ?? null) === previous,
      `previousEdition=${previous}`,
    ),
    check(
      "research.currentOrNextEdition",
      candidate !== null && (data?.currentOrNextEdition?.key ?? null) === next,
      `currentOrNextEdition=${next}`,
    ),
  ];
}

export function editionByKey(data: ResearchContext["data"], key: string) {
  return [data?.previousEdition, data?.currentOrNextEdition].find(
    (edition) => edition?.key === key,
  );
}

export function editionByYear(data: ResearchContext["data"], year: number) {
  return [data?.previousEdition, data?.currentOrNextEdition].find(
    (edition) => edition?.year?.value === year,
  );
}

export function returned(
  path: string,
  fact: { value: unknown } | undefined,
  expected: unknown,
) {
  return check(
    path,
    fact !== undefined && contains(fact.value, expected),
    `Expected ${JSON.stringify(expected)}`,
  );
}

/** Current-scope cases must omit Event summary and official links. */
export function omittedEventFields(data: ResearchContext["data"]) {
  return [
    ["summary", data?.summary],
    ["links.website", data?.links?.website],
    ["links.socials.instagram", data?.links?.socials?.instagram],
    ["links.socials.facebook", data?.links?.socials?.facebook],
    ["links.socials.youtube", data?.links?.socials?.youtube],
    ["links.socials.tiktok", data?.links?.socials?.tiktok],
    ["links.socials.x", data?.links?.socials?.x],
    ["links.socials.other", data?.links?.socials?.other],
  ].map(([field, value]) =>
    check(
      `research.event.${field}`,
      data !== null && value == null,
      `Omitted event.${field}`,
    ),
  );
}

export function oneNewEdition({ item, data }: ResearchContext, year: number) {
  const savedKeys = new Set(
    item.initial.event.editions.map((edition) => edition.editionKey),
  );
  const created = [data?.previousEdition, data?.currentOrNextEdition].filter(
    (edition) => edition != null && !savedKeys.has(edition.key),
  );
  return check(
    "research.newEditionYear",
    created.length === 1 && created[0]?.year?.value === year,
    `One new Edition for year=${year}`,
  );
}

/** Shared conditions for a deliberate Research refusal, not a technical failure. */
export function refusedResearch(report: CatalogResearchResult) {
  const candidate = report.modelResponse?.object;
  return [
    check(
      "research.status",
      report.researchStatus === "failed",
      "Expected researchStatus=failed",
    ),
    check(
      "research.outcome",
      report.outcome === "failed",
      "Expected catalog outcome=failed",
    ),
    check(
      "research.candidate",
      candidate == null ||
        (typeof candidate === "object" &&
          "decision" in candidate &&
          candidate.decision === "uncertain"),
      "No supported General targets",
    ),
    check(
      "research.operations",
      report.operations.length === 0,
      "Expected no operations",
    ),
    check(
      "research.receipts",
      report.receipts.length === 0,
      "Expected no receipts",
    ),
    check(
      "research.changes",
      report.changes.length === 0,
      "Expected no catalog changes",
    ),
    check(
      "research.sourceSummaries",
      report.sourceSummaries.length === 0,
      "Expected no source summaries",
    ),
    check(
      "research.references",
      Object.keys(report.references).length === 0,
      "Expected no references",
    ),
    check(
      "research.sources",
      report.sources.length > 0,
      "Expected at least one inspected source",
    ),
    check(
      "research.errors",
      !report.errors.some((error) =>
        [
          "model_failed",
          "invalid_candidate",
          "write_failed",
          "limit_reached",
        ].includes(error.code),
      ),
      "Expected refusal without model, candidate, write, or limit errors",
    ),
  ];
}

export function unavailableSources(report: CatalogResearchResult) {
  const unavailable = new Set(
    report.sources
      .filter((source) => ["failed", "unsupported"].includes(source.outcome))
      .map((source) => source.attemptedUrl),
  );
  return [
    check(
      "research.sources.unavailable",
      report.sources.every((source) =>
        ["failed", "unsupported"].includes(source.outcome),
      ),
      "Expected all inspected sources to be unavailable",
    ),
    check(
      "research.sourceError",
      report.errors.some(
        (error) =>
          error.stage === "source" &&
          [
            "source_blocked",
            "source_unavailable",
            "source_unsupported",
          ].includes(error.code) &&
          Boolean(error.url && unavailable.has(error.url)) &&
          error.message.trim().length > 0,
      ),
      "Expected a source-failure diagnosis for an unavailable inspected URL",
    ),
  ];
}
