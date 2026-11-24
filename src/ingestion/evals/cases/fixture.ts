import type { RegressionPipelineCaseFile } from "../fixtures";

type SourceReplay = RegressionPipelineCaseFile["sources"][number];

export function refreshInput(eventId: string, scope?: "current" | "full") {
  return {
    mode: "refresh",
    eventId,
    actor: "catalog-research",
    initiatedBy: "eval",
    dryRun: true,
    ...(scope ? { scope } : {}),
  } as const;
}

export function sourceReplay(
  attemptedUrl: string,
  retrievedAt: string,
  markdownFile: string,
  overrides: Pick<
    Partial<SourceReplay>,
    "finalUrl" | "method" | "status" | "reasonCode" | "readerOutput"
  > = {},
): SourceReplay {
  const {
    finalUrl = attemptedUrl,
    method = "http",
    status = "ok",
    reasonCode,
    readerOutput,
  } = overrides;

  return {
    attemptedUrl,
    finalUrl,
    retrievedAt,
    markdownFile,
    method,
    status,
    ...(reasonCode === undefined ? {} : { reasonCode }),
    ...(readerOutput === undefined ? {} : { readerOutput }),
  };
}
