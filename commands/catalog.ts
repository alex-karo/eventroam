import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import got from "got";
import { z } from "zod";
import {
  studioIngestionResultSchema,
  type StudioIngestionResult,
} from "@/ingestion/workflow-result";
import { parseCatalogOptions, catalogUsage } from "./catalog-options";

const workflowPath = "/api/workflows/catalog-ingestion";
const workflowResponse = z.object({
  status: z.string().optional(),
  result: studioIngestionResultSchema.optional().catch(undefined),
  error: z.union([z.string(), z.object({ message: z.string() })]).optional(),
  steps: z
    .object({
      "initialize-run": z
        .object({ output: z.object({ ingestionRunId: z.uuid() }).optional() })
        .optional(),
    })
    .optional(),
});
const persistenceError = z.object({
  code: z.literal("run_persistence_failed"),
});

type CommandFailure = {
  eventId?: string;
  engineRunId?: string;
  ingestionRunId?: string;
  code: string;
};

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function responseFailure(
  status: number,
  response: z.infer<typeof workflowResponse> | undefined,
) {
  const error = response?.error;
  if (error === "workflow_history_failed") {
    return error;
  }
  if (status === 500 && error === "Ingestion workflow failed") {
    return "workflow_failed";
  }
  if (status >= 400 && status < 500) {
    return "studio_rejected_request";
  }
  if (status !== 200) {
    return "studio_outcome_unknown";
  }
  if (response?.status === "canceled") {
    return "workflow_canceled";
  }
  if (response?.status !== "failed") {
    return "studio_outcome_unknown";
  }
  return typeof error === "object" &&
    persistenceError.safeParse(parseJson(error.message)).success
    ? "run_persistence_failed"
    : "workflow_failed";
}

function formatSummary(result: StudioIngestionResult) {
  const research =
    result.researchStatus === "partial" ? " (partial research)" : "";
  const codes = result.errorCodes.length
    ? ` (${result.errorCodes.join(", ")})`
    : "";
  return `${result.outcome}: ${result.eventId ?? "new Event"}${research}${codes} [run ${result.ingestionRunId}, workflow ${result.engineRunId}]`;
}

function formatFailure(failure: CommandFailure) {
  const ids = [
    failure.ingestionRunId && `run ${failure.ingestionRunId}`,
    failure.engineRunId && `workflow ${failure.engineRunId}`,
  ].filter(Boolean);
  const reference = ids.length ? ` [${ids.join(", ")}]` : "";
  return `failed: ${failure.eventId ?? "new Event"} (${failure.code})${reference}`;
}

export async function executeCatalogCommand(
  args: string[],
  {
    stdout = console.log,
    stderr = console.error,
  }: {
    stdout?: (value: string) => void;
    stderr?: (value: string) => void;
  } = {},
) {
  const options = parseCatalogOptions(args);
  if (options.help) {
    stdout(catalogUsage);
    return 0;
  }
  const targets = options.mode === "add" ? [undefined] : options.eventIds;
  const results: StudioIngestionResult[] = [];
  const failures: CommandFailure[] = [];
  for (const eventId of targets) {
    const engineRunId = randomUUID();
    stderr(`Workflow ${engineRunId}. Inspect it in Studio Recent runs.`);
    // A run can outlast fetch's default response header timeout.
    const started = await got
      .post(new URL(`${workflowPath}/start-async`, options.url), {
        searchParams: { runId: engineRunId },
        json: {
          inputData: {
            mode: options.mode,
            input: eventId ? { eventId, scope: options.scope } : options.input,
            dryRun: options.dryRun,
            republish: options.republish,
          },
        },
        retry: { limit: 0 },
        followRedirect: false,
        throwHttpErrors: false,
      })
      .catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
          stderr(
            `Cannot reach Studio at ${options.url.origin}. Start it with pnpm run catalog:studio.`,
          );
          failures.push({ eventId, code: "studio_unreachable" });
        } else {
          failures.push({
            eventId,
            engineRunId,
            code: "studio_outcome_unknown",
          });
        }
        return undefined;
      });
    if (!started) {
      continue;
    }

    const response = workflowResponse.safeParse(parseJson(started.body)).data;
    const result = response?.result;
    if (
      started.statusCode === 200 &&
      response?.status === "success" &&
      result?.engineRunId === engineRunId
    ) {
      results.push(result);
    } else {
      failures.push({
        eventId,
        engineRunId,
        ingestionRunId:
          response?.steps?.["initialize-run"]?.output?.ingestionRunId,
        code: responseFailure(started.statusCode, response),
      });
    }
  }
  stdout(
    options.json
      ? JSON.stringify({ dryRun: options.dryRun, results, failures }, null, 2)
      : [
          options.dryRun ? "Catalog preview" : "Catalog apply",
          ...results.map(formatSummary),
          ...failures.map(formatFailure),
        ].join("\n"),
  );
  return failures.length ||
    results.some(
      (result) =>
        result.outcome === "failed" ||
        result.persistenceStatus === "failed" ||
        result.errorCodes.includes("workflow_failed") ||
        result.errorCodes.includes("run_persistence_failed"),
    )
    ? 1
    : 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  executeCatalogCommand(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(
        error instanceof Error ? error.message : "Catalog command failed",
      );
      process.exitCode = 1;
    });
}
