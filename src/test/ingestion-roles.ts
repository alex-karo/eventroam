import type {
  ResearchDependencies,
  CatalogResearchInput,
} from "@/ingestion/contracts";
import type {
  ResearchCandidate,
  ResearchEdition,
} from "@/ingestion/research/contracts";
import type { GenerateRole } from "@/ingestion/roles/invoke";
import { loadResearchContext } from "@/ingestion/research/context";
import {
  promptFor,
  modelContext,
} from "@/test/ingestion-fixtures/research-input";
import type { ReadPageResult } from "@/ingestion/tools/read-page/contracts";
import { editorPlanSchema } from "@/test/ingestion-fixtures/editor-contracts";
import { sourceUrlSchema } from "@/ingestion/tools/contracts";
import { locationTextFields } from "@/ingestion/location/contracts";

/** Migrate explicit outcome fixtures to role calls. No live generation fallback. */
export function fixtureRoleDependencies(
  input: CatalogResearchInput,
  deps: ResearchDependencies,
): ResearchDependencies {
  if (!deps.generateCandidate || deps.generateRole) {
    return deps;
  }

  let candidate: ResearchCandidate | undefined;
  const reads: ReadPageResult[] = [];
  let inspected = false;
  const checks = (keys: string[], status = "success") =>
    keys.map((check) => ({
      check,
      finding: status === "partial" ? "unfinished" : "verified",
      explanation: "Explicit fixture check",
      evidenceIds: [],
      sourceIds: [],
    }));
  const generate: GenerateRole = async (role, prompt, call) => {
    const data = JSON.parse(prompt);
    if (role === "reader") {
      reads.push({ ...data.source, markdown: data.page });
      return {
        overview: "Explicit fixture source",
        topics: [
          "identity",
          "dates",
          "location",
          "tickets",
          "links",
          "classification",
          "description",
        ],
        statedYears: [],
        limitations: [],
        evidence: [
          {
            quote: data.page,
            context: [],
            topics: [
              "identity",
              "dates",
              "location",
              "tickets",
              "links",
              "classification",
              "description",
            ],
            editionClues: [],
            uncertainty: null,
          },
        ],
      };
    }
    const navigate = async () => {
      const context = loadResearchContext(
        deps.client,
        input,
        deps.todayUtc
          ? `${deps.todayUtc}T12:00:00.000Z`
          : "2026-10-31T12:00:00Z",
      );

      const inspect = async (url: string) => {
        sourceUrlSchema.parse(url);
        inspected = true;
        const tool = call.tools?.inspectPage as unknown as {
          execute: (
            args: { url: string },
            context: unknown,
          ) => Promise<unknown>;
        };
        await tool.execute({ url }, {});
        return (
          reads.findLast((read) => read.attemptedUrl === url) ?? reads.at(-1)!
        );
      };
      const search = async (query: string) => {
        const tool = call.tools?.searchWeb as unknown as {
          execute: (
            args: { query: string },
            context: unknown,
          ) => Promise<unknown>;
        };
        return (await tool.execute(
          { query },
          {},
        )) as import("@/ingestion/tools/search-web/contracts").SearchWebResult;
      };
      candidate = (await deps.generateCandidate!(
        promptFor(
          input,
          context.catalog,
          context.knownLinks,
          context.terms,
          call.budget.remaining(),
          reads,
          context.currentDate,
        ),
        { budget: call.budget, reads, readPage: inspect, searchWeb: search },
      )) as ResearchCandidate;
      if (!candidate || !("status" in candidate)) {
        return candidate;
      }
      if (candidate.status === "failed") {
        throw new Error("Explicit fixture collection failure");
      }
      for (const source of candidate.data?.sources ?? []) {
        if (!reads.some((read) => read.attemptedUrl === source.url)) {
          await inspect(source.url);
        }
      }
      if (!inspected && candidate.data && !candidate.data.sources.length) {
        await inspect("https://fixture.example/source");
      }
      return {
        checks: checks(
          data.checks.map((check: { key: string }) => check.key),
          candidate.status,
        ),
        completionReason: "Explicit fixture collection complete",
        unresolved: candidate.unresolved ?? [],
      };
    };
    if (role === "research") {
      return navigate();
    }
    const research = candidate?.data;
    const ids =
      data.corpus?.evidence.map((item: { id: string }) => item.id) ?? [];
    const action = (fact: { value: unknown; reason: string }) => ({
      action: fact.value === null ? "clear" : "set",
      ...(fact.value === null ? {} : { value: fact.value }),
      reason: fact.reason,
      evidenceIds: ids,
    });
    const general = () => {
      if (!research) {
        return {
          decision: "uncertain",
          reason: "Fixture has no usable identity",
          unresolved: [],
        };
      }
      const identity = {
        eventId: research.eventId ?? input.eventId ?? null,
        observedEventName: research.eventName,
        reason: research.reason ?? "Explicit fixture identity",
        evidenceIds: ids,
      };
      if (input.mode === "add" && research.eventId) {
        return { decision: "duplicate", ...identity };
      }
      const target = (value: ResearchEdition | null) =>
        value
          ? {
              editionKey: value.key,
              reason: "Explicit fixture target",
              evidenceIds: ids,
              fields: Object.fromEntries(
                Object.entries(value)
                  .filter(([key]) =>
                    [
                      "year",
                      "dates",
                      "scheduleStatus",
                      "displayName",
                      "sizeEstimate",
                    ].includes(key),
                  )
                  .map(([key, fact]) => [
                    key,
                    action(fact as { value: unknown; reason: string }),
                  ]),
              ),
            }
          : null;
      return {
        decision: "targets",
        ...identity,
        event: research.summary ? { summary: action(research.summary) } : {},
        previousEdition: target(research.previousEdition),
        currentOrNextEdition: target(research.currentOrNextEdition),
        checks: checks(data.assignedChecks ?? [], candidate?.status),
        unresolved: [],
      };
    };

    const tickets = () => {
      const fact = research?.currentOrNextEdition?.tickets;
      return {
        currentOrNextEdition: fact?.value.variants.length
          ? {
              tickets: {
                ...action(fact),
                value: {
                  ...fact.value,
                  variants: fact.value.variants.map((offer) =>
                    Object.fromEntries(
                      Object.entries(offer).filter(([key]) => key !== "url"),
                    ),
                  ),
                },
              },
            }
          : {},
        checks: checks(data.assignedChecks ?? [], candidate?.status),
        unresolved: [],
      };
    };

    const classification = () => {
      return {
        previousEdition: research?.previousEdition
          ? {
              ...(research.previousEdition.classification
                ? {
                    classification: action(
                      research.previousEdition.classification,
                    ),
                  }
                : {}),
            }
          : null,
        currentOrNextEdition: research?.currentOrNextEdition
          ? {
              ...(research.currentOrNextEdition.classification
                ? {
                    classification: action(
                      research.currentOrNextEdition.classification,
                    ),
                  }
                : {}),
            }
          : null,
        checks: checks(data.assignedChecks ?? [], candidate?.status),
        unresolved: [],
      };
    };

    const links = () => {
      const link = (url: string) => ({
        action: "set",
        value: url,
        reason: "Explicit fixture association",
        evidenceIds: ids,
      });
      return {
        event: {
          ...(research?.links.website
            ? { website: link(research.links.website) }
            : {}),
          socials: Object.fromEntries(
            Object.entries(research?.links.socials ?? {}).map(([key, url]) => [
              key,
              link(url),
            ]),
          ),
        },
        currentOrNextEdition: research?.currentOrNextEdition
          ? {
              ...(research.currentOrNextEdition.links.tickets
                ? { tickets: link(research.currentOrNextEdition.links.tickets) }
                : {}),
            }
          : null,
        checks: checks(data.assignedChecks ?? [], candidate?.status),
        omitted: [],
        unresolved: [],
      };
    };

    if (role === "general") {
      return general();
    }
    if (role === "tickets") {
      return tickets();
    }
    if (role === "classification") {
      return classification();
    }
    if (role === "links") {
      return links();
    }
    const context = loadResearchContext(
      deps.client,
      input,
      deps.todayUtc ? `${deps.todayUtc}T12:00:00.000Z` : "2026-10-31T12:00:00Z",
    );
    const old = deps.generateEditor
      ? ((await deps.generateEditor(
          JSON.stringify({
            research: candidate,
            catalog: context.catalog[0]
              ? modelContext(context.catalog[0])
              : null,
            currentDate: context.currentDate,
            mode: input.mode,
            scope: input.scope ?? null,
            terms: context.terms,
          }),
          call,
        )) as Record<string, unknown>)
      : undefined;
    if (old && !editorPlanSchema.safeParse(old).success) {
      return old;
    }
    const decide = (
      schema: Record<string, unknown>,
      oldValue: unknown,
    ): unknown => {
      if (schema.type === "null") {
        return null;
      }
      if (schema.type === "array") {
        return [];
      }
      const properties = schema.properties as Record<
        string,
        Record<string, unknown>
      >;
      if (properties.decision) {
        const action = (oldValue as { action?: string } | undefined)?.action;
        return {
          decision: action === "keep" ? "reject" : "approve",
          reason: "Explicit fixture review",
        };
      }
      return Object.fromEntries(
        Object.entries(properties).map(([key, value]) => [
          key,
          decide(value, (oldValue as Record<string, unknown> | null)?.[key]),
        ]),
      );
    };
    const review = decide(data.decisionShape, old) as Record<string, unknown>;
    if (old && (old.status === "rejected" || old.event === null)) {
      review.item = {
        decision: "reject",
        reason:
          (old.reason as string) ??
          "Sources do not establish festival identity",
      };
      review.unresolved = old.unresolved ?? [];
    }
    return review;
  };
  const generateLocation =
    deps.generateLocation ??
    (async (prompt: string) => {
      const data = JSON.parse(prompt);
      const slot = (name: "previousEdition" | "currentOrNextEdition") => {
        if (!data[name]) {
          return null;
        }
        const finding = candidate?.data?.[name];
        return {
          fields: Object.fromEntries(
            locationTextFields.map((field) => {
              const fact = finding?.[field];
              return [
                field,
                fact
                  ? {
                      action: fact.value === null ? "clear" : "set",
                      ...(fact.value === null ? {} : { value: fact.value }),
                      reason: fact.reason,
                    }
                  : { action: "keep", reason: "Fixture preserves saved field" },
              ];
            }),
          ),
          coordinates:
            finding?.coordinates?.value === null
              ? { action: "clear", reason: finding.coordinates.reason }
              : { action: "keep", reason: "Fixture preserves point" },
          evidenceIds: data.evidence.map((item: { id: string }) => item.id),
          unresolved: [],
        };
      };
      return {
        decision: {
          status: "ready",
          previousEdition: slot("previousEdition"),
          currentOrNextEdition: slot("currentOrNextEdition"),
        },
      };
    });
  return {
    ...deps,
    readPage:
      deps.readPage ??
      (async (url) => ({
        attemptedUrl: url,
        finalUrl: url,
        retrievedAt: "2026-10-31T00:00:00Z",
        status: "ok",
        method: "http",
        markdown: "Explicit test source",
      })),
    generateRole: generate,
    generateLocation,
  };
}
