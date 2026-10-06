import { applyCatalogItem } from "@/catalog/write/apply-operation";
import type {
  CatalogResearchInput,
  CatalogResearchResult,
  ResearchDependencies,
} from "./contracts";
import { createResearchBudget } from "./runtime/budget";
import { loadResearchConfig } from "./runtime/config";
import { loadResearchContext } from "./research/context";
import { createSourceSession } from "./sources/session";
import { researchFestival } from "./research/agent";
import { prepareResearch } from "./research/prepare";
import type { ResearchGap } from "./research/contracts";
import { buildResearchReport } from "./report";

export type {
  CatalogResearchInput,
  CatalogResearchResult,
  ResearchDependencies,
} from "./contracts";

export async function runCatalogResearch(
  input: CatalogResearchInput,
  deps: ResearchDependencies,
): Promise<CatalogResearchResult> {
  const started = Date.now();
  if (input.mode === "add" && !input.name)
    throw new Error("add requires a festival name");
  if (input.mode !== "add" && !input.eventId)
    throw new Error(`${input.mode} requires an Event ID`);
  const config =
    deps.config ??
    (deps.generateCandidate
      ? {
          apiKey: "fixture",
          model: "fixture",
          limits: createResearchBudget().limits,
        }
      : loadResearchConfig());
  const budget = createResearchBudget({ ...config.limits, ...input.limits });
  const context = loadResearchContext(deps.client, input);
  const sources = createSourceSession(budget, config, context.knownLinks, deps);
  await sources.readInitialSource();
  const research = await researchFestival(
    input,
    context,
    sources,
    budget,
    config,
    deps,
  );
  let prepared: ReturnType<typeof prepareResearch> | null = null;
  let gaps: ResearchGap[];
  if (research.ok) {
    prepared = prepareResearch(
      research.candidate,
      context.catalog,
      input,
      context.terms,
    );
    gaps = prepared.gaps;
  } else {
    gaps = research.gaps;
  }
  let applied: ReturnType<typeof applyCatalogItem> | null = null;
  let writeFailed = false;
  try {
    if (prepared?.operations.length) {
      applied = applyCatalogItem(deps.client, prepared.operations, {
        dryRun: input.dryRun ?? true,
      });
    }
  } catch (error) {
    writeFailed = true;
    gaps.push({
      code: "write_failed",
      detail:
        error instanceof Error
          ? error.message.slice(0, 200)
          : "Catalog write failed",
    });
  }
  return buildResearchReport({
    input,
    config,
    prepared,
    research,
    applied,
    writeFailed,
    gaps,
    reads: sources.reads,
    discovery: sources.discovery,
    budget: budget.snapshot(),
    started,
    finished: Date.now(),
  });
}
