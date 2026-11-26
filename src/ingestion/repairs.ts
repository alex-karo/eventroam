import type { Evidence } from "./evidence/contracts";
import {
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
import { locationTextFields } from "./roles/location/contracts";
import {
  groupDiagnostic,
  failProposal,
  RepairFailure,
  replyReferences,
  type GroupIssue,
  type GroupValidationInput,
  type ProposalValidationContext,
} from "./roles/proposal-validation";
import type { SpecialistContext } from "./roles/options";
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

type RepairContext = Omit<
  ProposalValidationContext,
  "location" | "targets" | "savedEditions"
>;
type TargetedRepairContext = RepairContext & {
  targets: Targets;
  groups: readonly ProposalGroup[];
  savedEditions: SpecialistContext["savedEditions"];
};
type GeneralRepairResult = {
  targets: StageResult<Targets & PlanDiagnostics>;
  revisedOutput?: Targets;
};
type OnReturnStarted = (requests: ReturnRequest[]) => void;

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

function ownGroups(groups: readonly ProposalGroup[], owner: GroupOwner) {
  return groups.filter((group) => group.owner === owner);
}

function checkedGeneralTargets(raw: unknown): Targets {
  // The merge checks the role schema before it saves the reply.
  const output = raw as GeneralOutput | undefined;
  if (output?.decision !== "targets") {
    throw new Error("Missing validated General targets");
  }
  return output;
}

export class ProposalRepairs {
  private replies = new Map<GroupOwner, RoleConversation>();
  readonly records: RepairRecord[] = [];
  private location?: LocationValidationContext;

  get returnedPaths() {
    return new Set(this.records.map(({ path }) => path));
  }

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
    this.location = { input, session };
  };

  clear() {
    this.replies.clear();
    this.location = undefined;
  }

  raw(owner: GroupOwner) {
    return this.replies.get(owner)?.raw;
  }

  canReturn(owner: GroupOwner) {
    return this.replies.get(owner)?.revise !== undefined;
  }

  materializeLocation() {
    const raw = this.raw("location");
    if (raw) {
      return materializeLocationReply(raw, this.location!, this.returnedPaths);
    }
  }

  async general(
    context: RepairContext,
    signal: AbortSignal,
  ): Promise<GeneralRepairResult | undefined> {
    const reply = this.replies.get("general");
    if (!reply?.raw) {
      return;
    }
    const ctx = { ...context, targets: null };
    const { targets, groups, issues, output } = validateGeneralReply(
      reply,
      ctx,
    );
    if (targets.status !== "continue" || !issues.length) {
      if (output) {
        reply.raw = output;
      }
      return { targets };
    }
    await this.dispatch(
      "general",
      this.validationRequests(issues),
      groups,
      { ...ctx, targets: targets.value },
      "validation",
      signal,
    );
    const revisedOutput = checkedGeneralTargets(reply.raw);
    return {
      targets: validateGeneral(revisedOutput, ctx),
      revisedOutput,
    };
  }

  async beforeReview(context: TargetedRepairContext, signal: AbortSignal) {
    const ctx = { ...context, location: this.location };
    const { groups } = context;
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
    context: TargetedRepairContext,
    requests: ReturnRequest[],
    signal: AbortSignal,
    onReturnStarted?: OnReturnStarted,
  ) {
    const ctx = { ...context, location: this.location };
    const { groups } = context;
    const start = this.records.length;
    await this.returnGroups(
      requests,
      groups,
      ctx,
      "editor",
      signal,
      onReturnStarted,
    );
    const end = this.records.length;
    const records: readonly Readonly<RepairRecord>[] = this.records.slice(
      start,
      end,
    );
    return {
      outputs: this.checkedSpecialistOutputs(ctx),
      records,
      generalTargets: records.some(({ owner }) => owner === "general")
        ? checkedGeneralTargets(this.replies.get("general")?.raw)
        : undefined,
      recordEditorFailure: (failure: ResearchError | undefined) => {
        for (let index = start; index < end; index++) {
          this.records[index].failure = failure;
        }
      },
    };
  }

  private checkedSpecialistOutputs(
    ctx: TargetedRepairContext,
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
            ctx.savedEditions,
            ctx.terms,
          )
        : null,
      links,
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
    groups: readonly ProposalGroup[],
    ctx: ProposalValidationContext,
    trigger: RepairRecord["trigger"],
    signal: AbortSignal,
    onReturnStarted?: OnReturnStarted,
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
        onReturnStarted,
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
    onReturnStarted?: OnReturnStarted,
  ) {
    let pending = requests;
    while (pending.length) {
      const issues = await this.reviseGroups(
        owner,
        pending,
        groups,
        ctx,
        trigger,
        signal,
        onReturnStarted,
      );
      // Validation retries are part of the same return.
      onReturnStarted = undefined;
      const counts = this.returnCounts;
      pending = this.validationRequests(issues)
        .filter(({ group }) => {
          if ((counts.get(group.path) ?? 0) < MAX_GROUP_RETURNS) {
            return true;
          }
          const entry = this.records.findLast(
            ({ path }) => path === group.path,
          )!;
          entry.decision = {
            path: group.path,
            decision: "reject",
            note: entry.failure!.message,
          };
          return false;
        })
        .map((request) => {
          const note = requests.find(
            ({ group }) => group.path === request.group.path,
          )!.note;
          return {
            ...request,
            note: `${note}\nValidation feedback:\n${request.note}`,
          };
        });
    }
  }

  private async reviseGroups(
    owner: GroupOwner,
    requests: ReturnRequest[],
    groups: ProposalGroup[],
    ctx: ProposalValidationContext,
    trigger: RepairRecord["trigger"],
    signal: AbortSignal,
    onReturnStarted?: OnReturnStarted,
  ) {
    const original = this.replies.get(owner);
    const counts = this.returnCounts;
    const records = requests.map(({ group, note }): RepairRecord => {
      if ((counts.get(group.path) ?? 0) >= MAX_GROUP_RETURNS) {
        failProposal("Group has no returns left", group.path);
      }
      const { target: slot } = group;
      const target = {
        eventId: ctx.savedEvent?.id ?? null,
        ...(slot !== "event" && {
          editionKey: ctx.targets?.[slot]?.editionKey,
        }),
      };
      const previous = this.records.findLast(({ path }) => path === group.path);
      return {
        owner,
        path: group.path,
        target,
        trigger,
        note,
        original: previous?.failure
          ? (previous.revision ?? null)
          : (atPath(original?.raw, group.rawPath) ?? null),
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
      onReturnStarted?.(requests);
      const revision = await original.revise(
        {
          instructions:
            "Revise only the requested groups. Return the normal role reply." +
            (owner === "location"
              ? ""
              : " If you omit a requested optional group, add an unresolved entry. Copy the full path from that group into field and explain the omission in message."),
          groups: records.map(({ path, note, original }) => ({
            path,
            note,
            original,
          })),
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
      return this.mergeRevision(
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
    const validate = validators[owner];
    const validation = { groups, ctx, returnedPaths: this.returnedPaths };
    const only = new Set(requests.map(({ group }) => group.path));
    const { issues } = validate({
      ...validation,
      reply: { schema: original.schema, raw: revision },
      only,
    });
    for (const { group } of requests) {
      if (owner === "location" || atPath(revision, group.rawPath) != null) {
        continue;
      }
      const reason = this.questions(revision, group.path)[0]?.message;
      if (typeof reason !== "string" || !reason.trim()) {
        issues.push({
          group,
          rule:
            "An omitted revision needs a reason for its exact group path: " +
            group.path,
        });
      }
    }
    if (owner === "general") {
      requireFixedGeneralTargets(revision, ctx, issues);
    }
    const merged = structuredClone(original.raw);
    for (const [index, { group }] of requests.entries()) {
      const value = atPath(revision, group.rawPath);
      const entry = records[index];
      const support = new Set(replyReferences(value, "evidenceIds"));
      entry.evidence = ctx.corpus.evidence.filter(({ id }) => support.has(id));
      if (!issues.some((issue) => issue.group.path === group.path)) {
        setPath(merged, group.rawPath, value);
        this.mergeQuestions(merged, revision, entry, value == null);
      }
    }
    for (const { group } of issues) {
      this.dropGroup(merged, group);
    }
    const checked = validate({
      ...validation,
      reply: { schema: original.schema, raw: merged },
    });
    for (const issue of checked.issues) {
      if (!only.has(issue.group.path)) {
        throw new RepairFailure(groupDiagnostic(issue));
      }
      issues.push(issue);
      this.dropGroup(merged, issue.group);
    }
    const { parsed, issues: remaining } = checked.issues.length
      ? validate({
          ...validation,
          reply: { schema: original.schema, raw: merged },
        })
      : checked;
    if (remaining.length) {
      throw new RepairFailure(groupDiagnostic(remaining[0]));
    }
    if (owner === "general") {
      requireFixedGeneralTargets(merged, ctx, issues);
    }
    original.raw = parsed.data;
    for (const entry of records) {
      const issue = issues.find(({ group }) => group.path === entry.path);
      if (issue) {
        entry.failure = groupDiagnostic(issue);
      }
    }
    return issues;
  }

  private dropGroup(raw: unknown, group: ProposalGroup) {
    const reason = "The returned group did not pass validation";
    setPath(
      raw,
      group.rawPath,
      group.owner === "location"
        ? {
            fields: Object.fromEntries(
              locationTextFields.map((field) => [
                field,
                { action: "keep", reason },
              ]),
            ),
            coordinates: { action: "keep", reason },
            evidenceIds: [],
            unresolved: [],
          }
        : undefined,
    );
  }

  private questions(raw: unknown, path: string) {
    const answer = (record(raw)?.unresolved as unknown[]) ?? [];
    return answer.flatMap((item) => {
      const question = record(item);
      return question?.field === path ? [question] : [];
    });
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
    const supplied = this.questions(raw, entry.path);
    if (omitted) {
      entry.omissionReason = (supplied[0].message as string).trim();
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
