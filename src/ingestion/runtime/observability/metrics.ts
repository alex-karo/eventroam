import type {
  CorrelationContext,
  MetricEvent,
} from "@mastra/core/observability";
import {
  knownEntity,
  nonnegative,
  safeCostContext,
  technicalId,
} from "./fields";

/** Metric contexts may have been cached before the span processor ran. */
export function projectMetric(event: MetricEvent, runId?: string): MetricEvent {
  const metric = event.metric;
  if (
    !technicalId(metric.name) ||
    nonnegative(metric.value) === undefined ||
    !technicalId(metric.metricId) ||
    !Number.isFinite(metric.timestamp.getTime())
  ) {
    throw new Error("Invalid metric");
  }
  const context = metric.correlationContext;
  const entity = knownEntity(context?.entityId);
  const parent = knownEntity(context?.parentEntityId);
  const root = knownEntity(context?.rootEntityId);
  const correlationContext: CorrelationContext = {
    ...entity,
    parentEntityId: parent?.entityId,
    parentEntityType: parent?.entityType,
    parentEntityName: parent?.entityName,
    rootEntityId: root?.entityId,
    rootEntityType: root?.entityType,
    rootEntityName: root?.entityName,
    runId,
    serviceName: "eventroam-research",
  };
  const labels: Record<string, string> = {};
  if (["ok", "error"].includes(metric.labels.status)) {
    labels.status = metric.labels.status;
  }
  if (metric.labels.usageIncomplete === "true") {
    labels.usageIncomplete = "true";
  }
  return {
    type: "metric",
    metric: {
      metricId: metric.metricId,
      timestamp: metric.timestamp,
      name: metric.name,
      value: metric.value,
      traceId: technicalId(metric.traceId),
      spanId: technicalId(metric.spanId),
      labels,
      correlationContext,
      costContext: safeCostContext(metric.costContext),
    },
  };
}
