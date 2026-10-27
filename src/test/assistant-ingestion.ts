import type { z } from "zod";
import type { studioIngestionResultSchema } from "../ingestion/workflow";

type StudioIngestionResult = z.infer<typeof studioIngestionResultSchema>;

export function assistantIngestionResult(
  overrides: Partial<StudioIngestionResult> = {},
): StudioIngestionResult {
  return {
    engineRunId: "engine-1",
    ingestionRunId: "ingestion-1",
    mode: "refresh",
    dryRun: true,
    outcome: "unchanged",
    researchStatus: "partial",
    editorStatus: "success",
    persistenceStatus: "completed",
    eventId: "event-1",
    scope: "full",
    savedEditionCount: 1,
    returnedEditionCount: 1,
    readCount: 1,
    searchCount: 0,
    operationCount: 0,
    changedCount: 0,
    locationStatus: "not_run",
    errorCodes: [],
    ...overrides,
  };
}
