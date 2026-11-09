import type { CatalogAttempt } from "./attempt";
import type { IngestionData } from "./contracts";
import type { Evidence, FrozenCorpus } from "./evidence/contracts";
import {
  savedCitation,
  savedPages,
  savedSearchInstructions,
} from "./evidence/repair";
import {
  assignedGroups,
  MAX_GROUP_RETURNS,
  atPath,
  record,
  setPath,
  type GroupOwner,
  type ProposalGroup,
  type ReturnRequest,
} from "./groups";
import type { ResearchError } from "./research/contracts";
import type { SpecialistOutputs } from "./proposals";
import type { ClassificationReply } from "./roles/classification/contracts";
import { materializeClassificationReply } from "./roles/classification/terms";
import { validateClassificationReply } from "./roles/classification/validate";
import type { ReviewDecision } from "./roles/editor/contracts";
import type { GeneralOutput, Targets } from "./roles/general/contracts";
import { validateGeneral } from "./roles/general/validate-targets";
import {
  requireFixedGeneralTargets,
  validateGeneralGroups,
  validateGeneralReply,
} from "./roles/general/validate";
import type { RoleConversation } from "./roles/invoke";
import type { LinksOutput } from "./roles/links/contracts";
import { validateLinksReply } from "./roles/links/validate";
import {
  materializeLocationReply,
  validateLocationGroups,
  type LocationValidationContext,
} from "./roles/location/group-validation";
import type { LocationInput } from "./roles/location/input";
import {
  failGroupIssue,
  failProposal,
  RepairFailure,
  replyReferences,
  selectedEvent,
  type GroupIssue,
  type GroupValidationInput,
  type ProposalValidationContext,
} from "./roles/proposal-validation";
import type { TicketsOutput } from "./roles/tickets/contracts";
import { validateTicketsReply } from "./roles/tickets/validate";
import type { StageResult, PlanDiagnostics } from "./stage";

const validators = {
  general: validateGeneralGroups,
  tickets: validateTicketsReply,
  classification: validateClassificationReply,
  links: validateLinksReply,
  location: validateLocationGroups,
} satisfies Record<GroupOwner, (options: GroupValidationInput) => unknown>;

export type RepairRecord = {
  path: string;
  owner: GroupOwner;
  target: { eventId: string | null; editionKey?: string };
  trigger: "validation" | "editor";
  note: string;
  original: unknown;
  revision?: unknown;
  omissionReason?: string;
  evidence?: Evidence[];
  decision?: ReviewDecision;
  failure?: ResearchError;
};

function ownGroups(groups: ProposalGroup[], owner: GroupOwner) {
  return groups.filter((group) => group.owner === owner);
}

export class ProposalRepairs {
  private replies = new Map<GroupOwner, RoleConversation>();
  private passages: Evidence[] = [];
  readonly records: RepairRecord[] = [];
  private location?: LocationValidationContext;

  get returnCounts() {
    const counts = new Map<string, number>();
    for (const { path } of this.records) {
      counts.set(path, (counts.get(path) ?? 0) + 1);
    }
    return counts;
  }

  capture = (owner: GroupOwner, reply: RoleConversation) => {
    this.replies.set(owner, reply);
  };

  captureLocation = (
    reply: RoleConversation,
    input: LocationInput,
    session: LocationValidationContext["session"],
  ) => {
    this.capture("location", reply);
    this.location = { input, session, repairPassages: this.passages };
  };

  clear() {
    this.replies.clear();
    this.location = undefined;
  }

  corpus(original: FrozenCorpus): FrozenCorpus {
    const retained = new Set(
      this.records.flatMap(
        ({ evidence }) => evidence?.map(({ id }) => id) ?? [],
      ),
    );
    return {
      ...original,
      evidence: [
        ...original.evidence,
        ...this.passages.filter(({ id }) => retained.has(id)),
      ],
    };
  }

  raw(owner: GroupOwner) {
    return this.replies.get(owner)?.raw;
  }

  canReturn(owner: GroupOwner) {
    return this.replies.get(owner)?.revise !== undefined;
  }

  materializeLocation(raw: unknown, evidence: Evidence[]) {
    return materializeLocationReply(raw, evidence, this.location!);
  }

  async general(
    owned: CatalogAttempt,
    data: IngestionData,
    signal: AbortSignal,
  ): Promise<StageResult<Targets & PlanDiagnostics> | undefined> {
    const reply = this.replies.get("general");
    if (!reply?.raw) {
      return;
    }
    const ctx = this.context(owned, data, null);
    const { targets, groups, issues, output } = validateGeneralReply(
      reply,
      ctx,
    );
    if (targets.status !== "continue" || !issues.length) {
      if (output) {
        reply.raw = output;
      }
      return targets;
    }
    await this.dispatch(
      "general",
      this.validationRequests(issues),
      groups,
      { ...ctx, targets: targets.value },
      "validation",
      signal,
    );
    const repaired = this.raw("general") as GeneralOutput;
    data.general = {
      ...data.general,
      status: "success",
      output: repaired,
      errors: [],
    };
    return validateGeneral(
      repaired,
      ctx.context,
      owned.input,
      this.corpus(data.corpus!),
    );
  }

  async beforeReview(
    owned: CatalogAttempt,
    data: IngestionData,
    targets: Targets,
    signal: AbortSignal,
  ) {
    const ctx = this.context(owned, data, targets);
    const groups = assignedGroups(owned.input.scope, targets);
    const issues: GroupIssue[] = [];
    const specialists = [
      "tickets",
      "classification",
      "links",
      "location",
    ] as const;
    for (const owner of specialists) {
      const reply = this.replies.get(owner);
      if (!reply) {
        continue;
      }
      const { parsed, issues: ownerIssues } = validators[owner]({
        reply,
        groups: ownGroups(groups, owner),
        ctx,
        available: ctx.corpus.evidence,
      });
      issues.push(...ownerIssues);
      if (!ownerIssues.length) {
        reply.raw = parsed.data;
      }
    }
    await this.returnGroups(
      this.validationRequests(issues),
      groups,
      ctx,
      "validation",
      signal,
    );
    return this.checkedSpecialistOutputs(ctx);
  }

  async afterReview(
    owned: CatalogAttempt,
    data: IngestionData,
    targets: Targets,
    requests: ReturnRequest[],
    signal: AbortSignal,
  ) {
    const ctx = this.context(owned, data, targets);
    const groups = assignedGroups(owned.input.scope, targets);
    await this.returnGroups(requests, groups, ctx, "editor", signal);
    return this.checkedSpecialistOutputs(ctx);
  }

  private checkedSpecialistOutputs(
    ctx: ProposalValidationContext,
  ): SpecialistOutputs {
    // Read each reply after its role schema and group checks pass.
    const links = this.raw("links") as LinksOutput | undefined;
    if (!links) {
      throw new Error("Missing validated Links reply");
    }
    const classification = this.raw("classification") as
      ClassificationReply | undefined;
    return {
      tickets: (this.raw("tickets") as TicketsOutput | undefined) ?? null,
      classification: classification
        ? materializeClassificationReply(
            classification,
            ctx.targets,
            selectedEvent(ctx),
            ctx.context.terms,
          )
        : null,
      links,
    };
  }

  private context(
    owned: CatalogAttempt,
    data: IngestionData,
    targets: Targets | null,
  ): ProposalValidationContext {
    return {
      corpus: this.corpus(data.corpus!),
      targets,
      context: data.context!,
      input: owned.input,
      location: this.location,
    };
  }

  private validationRequests(issues: GroupIssue[]): ReturnRequest[] {
    const grouped = Map.groupBy(issues, ({ group }) => group);
    return Array.from(grouped, ([group, groupIssues]) => ({
      group,
      note: groupIssues.map(({ rule }) => rule).join("\n"),
    }));
  }

  private async returnGroups(
    requests: ReturnRequest[],
    groups: ProposalGroup[],
    ctx: ProposalValidationContext,
    trigger: RepairRecord["trigger"],
    signal: AbortSignal,
  ) {
    const byOwner = Map.groupBy(requests, ({ group }) => group.owner);
    for (const [owner, ownerRequests] of byOwner) {
      await this.dispatch(
        owner,
        ownerRequests,
        ownGroups(groups, owner),
        ctx,
        trigger,
        signal,
      );
    }
  }

  private async dispatch(
    owner: GroupOwner,
    requests: ReturnRequest[],
    groups: ProposalGroup[],
    ctx: ProposalValidationContext,
    trigger: RepairRecord["trigger"],
    signal: AbortSignal,
  ) {
    const original = this.replies.get(owner);
    const counts = this.returnCounts;
    const records = requests.map(({ group, note }): RepairRecord => {
      if ((counts.get(group.path) ?? 0) >= MAX_GROUP_RETURNS) {
        failProposal("Group has no returns left", group.path);
      }
      const { target: slot } = group;
      const target = {
        eventId: selectedEvent(ctx)?.id ?? null,
        ...(slot !== "event" && {
          editionKey: ctx.targets?.[slot]?.editionKey,
        }),
      };
      return {
        owner,
        path: group.path,
        target,
        trigger,
        note,
        original: atPath(original?.raw, group.rawPath) ?? null,
      };
    });
    this.records.push(...records);
    try {
      signal.throwIfAborted();
      if (!original?.revise) {
        failProposal(
          `${owner}: no live conversation for a group return`,
          records[0].path,
          owner === "location" ? "location_failed" : "invalid_candidate",
        );
      }
      const { sourceFiles, tools } = await savedPages(ctx.corpus, signal);
      const revision = await original.revise(
        {
          instructions:
            "Revise only the requested groups. Return the normal role reply. " +
            (owner === "location"
              ? ""
              : "If you omit a requested optional group, add an unresolved entry. Copy the full path from that group into field and explain the omission in message. ") +
            savedSearchInstructions,
          groups: records.map(({ path, note, original }) => {
            const ids = new Set(replyReferences(original, "evidenceIds"));
            const evidence = this.passages.filter(({ id }) => ids.has(id));
            return {
              path,
              note,
              original,
              ...(evidence.length && { evidence }),
            };
          }),
          sourceFiles,
        },
        {
          ...tools,
          citeSavedPassage: savedCitation(ctx.corpus, this.passages, signal),
        },
        signal,
      );
      signal.throwIfAborted();
      if (revision.status !== "success" || !record(revision.output)) {
        const diagnostic = revision.errors[0];
        if (diagnostic) {
          throw new RepairFailure(diagnostic);
        }
        failProposal(`${owner}: no usable revision`, records[0].path);
      }
      this.mergeRevision(
        owner,
        original,
        revision.output,
        requests,
        groups,
        records,
        ctx,
      );
    } catch (error) {
      if (error instanceof RepairFailure) {
        for (const entry of records) {
          entry.failure = error.diagnostic;
        }
      } else if (signal.aborted) {
        for (const entry of records) {
          entry.failure = {
            code: "workflow_failed",
            stage: "workflow",
            message: "Repair cancelled",
          };
        }
      }
      throw error;
    }
  }

  private mergeRevision(
    owner: GroupOwner,
    original: RoleConversation,
    revision: unknown,
    requests: ReturnRequest[],
    groups: ProposalGroup[],
    records: RepairRecord[],
    ctx: ProposalValidationContext,
  ) {
    for (const [index, { group }] of requests.entries()) {
      records[index].revision = atPath(revision, group.rawPath) ?? null;
    }
    const evidenceById = new Map(
      [...ctx.corpus.evidence, ...this.passages].map((item) => [item.id, item]),
    );
    const available = [...evidenceById.values()];
    const validate = validators[owner];
    const validation = { groups, ctx, available };
    const only = new Set(requests.map(({ group }) => group.path));
    const { issues } = validate({
      ...validation,
      reply: { schema: original.schema, raw: revision },
      only,
    });
    if (owner === "general") {
      requireFixedGeneralTargets(revision, ctx, available);
    }
    if (issues.length) {
      failGroupIssue(issues[0]);
    }
    const merged = structuredClone(original.raw);
    for (const [index, { group }] of requests.entries()) {
      const value = atPath(revision, group.rawPath);
      const entry = records[index];
      const support = new Set(replyReferences(value, "evidenceIds"));
      entry.evidence = available.filter(({ id }) => support.has(id));
      setPath(merged, group.rawPath, value);
      this.mergeQuestions(merged, revision, entry, value == null);
    }
    const { parsed, issues: checked } = validate({
      ...validation,
      reply: { schema: original.schema, raw: merged },
    });
    if (checked.length) {
      failGroupIssue(checked[0]);
    }
    if (owner === "general") {
      requireFixedGeneralTargets(merged, ctx, available);
    }
    original.raw = parsed.data;
  }

  private mergeQuestions(
    merged: unknown,
    raw: unknown,
    entry: RepairRecord,
    omitted: boolean,
  ) {
    if (entry.owner === "location") {
      return;
    }
    const questions = (record(merged)?.unresolved as unknown[]) ?? [];
    const answer = (record(raw)?.unresolved as unknown[]) ?? [];
    const supplied = answer.filter(
      (item) => record(item)?.field === entry.path,
    );
    if (omitted) {
      const reason = record(supplied[0])?.message;
      if (typeof reason !== "string" || !reason.trim()) {
        failProposal(
          "An omitted revision needs a reason for its exact group",
          entry.path,
        );
      }
      entry.omissionReason = reason.trim();
    }
    record(merged)!.unresolved = [
      ...questions.filter((item) => record(item)?.field !== entry.path),
      ...supplied,
    ];
  }
}

export function repairDiagnostic(error: unknown) {
  if (error instanceof RepairFailure) {
    return error.diagnostic;
  }
  throw error;
}
