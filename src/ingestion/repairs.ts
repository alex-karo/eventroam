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
  atPath,
  record,
  setPath,
  type GroupOwner,
  type ProposalGroup,
} from "./groups";
import { editionSlotNames, type ResearchError } from "./research/contracts";
import {
  checkRefreshCountries,
  checkedClassification,
  validateGeneral,
} from "./proposals";
import type { RoleConversation } from "./roles/invoke";
import {
  festivalCountriesSchema,
  type ClassificationOutput,
  type GeneralOutput,
  type Targets,
} from "./roles/contracts";
import type { LocationInput } from "./location/input";
import {
  LocationCountryConflictError,
  validateLocation,
  type MaterializedLocation,
} from "./location/validate";
import type { GeocodingSession } from "./tools/geocode/tool";
import type { ReviewDecision } from "./review";
import type { StageResult, PlanDiagnostics } from "./stage";

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

type ReturnRequest = { group: ProposalGroup; note: string };
type GroupIssue = { group: ProposalGroup; rule: string };
type PointContext = Pick<GeocodingSession, "points" | "targets">;

class RepairFailure extends Error {
  constructor(readonly diagnostic: ResearchError) {
    super(diagnostic.message);
  }
}

function fail(
  message: string,
  field?: string,
  code: ResearchError["code"] = "invalid_candidate",
): never {
  throw new RepairFailure({
    code,
    stage: code === "location_failed" ? "location" : "validation",
    message,
    ...(field && { field }),
  });
}

function ownGroups(groups: ProposalGroup[], owner: GroupOwner) {
  return groups.filter((group) => group.owner === owner);
}

function references(value: unknown, key: string): unknown[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => references(entry, key));
  }
  return Object.entries(record(value) ?? {}).flatMap(([name, entry]) => {
    if (name === key) {
      return Array.isArray(entry) ? entry : [entry];
    }
    return references(entry, key);
  });
}

export class ProposalRepairs {
  private replies = new Map<GroupOwner, RoleConversation>();
  private passages: Evidence[] = [];
  readonly records: RepairRecord[] = [];
  private location?: { input: LocationInput; session: PointContext };

  get usedPaths() {
    return new Set(this.records.map(({ path }) => path));
  }

  capture = (owner: GroupOwner, reply: RoleConversation) => {
    this.replies.set(owner, reply);
  };

  captureLocation = (
    reply: RoleConversation,
    input: LocationInput,
    session: PointContext,
  ) => {
    this.capture("location", reply);
    this.location = { input, session };
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

  private requireReferences(
    owner: GroupOwner,
    raw: unknown,
    ctx: Context,
    available: Evidence[],
  ) {
    const known = (
      key: string,
      ids: readonly string[],
      description: string,
    ) => {
      if (
        references(raw, key).some(
          (id) => typeof id !== "string" || !ids.includes(id),
        )
      ) {
        fail(
          `${owner}: unknown ${description} reference`,
          undefined,
          owner === "location" ? "location_failed" : "invalid_candidate",
        );
      }
    };
    known(
      "evidenceIds",
      available.map(({ id }) => id),
      "evidence",
    );
    known(
      "sourceIds",
      ctx.corpus.sources.map(({ id }) => id),
      "source",
    );
    if (owner === "location") {
      known(
        "pointId",
        [...(this.location?.session.points.keys() ?? [])],
        "Location point",
      );
    }
    if (owner === "classification") {
      for (const slot of editionSlotNames) {
        const change = atPath(raw, `${slot}.classification`);
        const ids = record(change)?.value;
        if (
          Array.isArray(ids) &&
          ids.some(
            (id) =>
              typeof id === "string" &&
              !ctx.context.terms.some((term) => term.id === id),
          )
        ) {
          fail(
            "Unknown classification term",
            `${slot}.fields.classification`,
            "invalid_plan",
          );
        }
        const donor = atPath(change, "reuseFrom.editionKey");
        if (
          typeof donor === "string" &&
          !ctxEvent(ctx)?.editions.some(
            (edition) => edition.editionKey === donor,
          )
        ) {
          fail(
            "Unknown classification reuse Edition",
            `${slot}.fields.classification`,
            "invalid_plan",
          );
        }
      }
    }
  }

  private structuralIssues(
    owner: GroupOwner,
    raw: unknown,
    groups: ProposalGroup[],
  ) {
    const result = this.replies.get(owner)!.schema.safeParse(raw);
    if (result.success) {
      return [];
    }
    return result.error.issues.map((issue) => {
      const path = issue.path.join(".");
      const group = groups.find(
        ({ rawPath }) => path === rawPath || path.startsWith(rawPath + "."),
      );
      if (!group) {
        fail(
          owner === "location"
            ? `${path}:${issue.code}`
            : `${owner}: ${path}:${issue.code}`,
          undefined,
          owner === "location" ? "location_failed" : "invalid_candidate",
        );
      }
      return { group, rule: `${path}:${issue.code} ${issue.message}` };
    });
  }

  private inspect(
    owner: GroupOwner,
    raw: unknown,
    groups: ProposalGroup[],
    ctx: Context,
    available: Evidence[],
    only?: ReadonlySet<string>,
  ): GroupIssue[] {
    this.requireReferences(owner, raw, ctx, available);
    this.requireAssignment(owner, raw, ctx);
    const issues = this.structuralIssues(owner, raw, groups);
    const relevant = only
      ? groups.filter(({ path }) => only.has(path))
      : groups;
    if (owner === "location") {
      for (const slot of editionSlotNames) {
        if (this.location!.input[slot]) {
          this.checkLocationBoundary(raw, slot);
        }
      }
    }
    for (const group of relevant) {
      if (issues.some((issue) => issue.group === group)) {
        continue;
      }
      const rule = this.groupRule(group, raw, ctx, available);
      if (rule) {
        issues.push({ group, rule });
      }
    }
    return only ? issues.filter(({ group }) => only.has(group.path)) : issues;
  }

  private requireAssignment(owner: GroupOwner, raw: unknown, ctx: Context) {
    if (owner === "general") {
      return;
    }
    const checks = atPath(raw, "checks");
    const eventCheck =
      Array.isArray(checks) &&
      checks.some((finding) =>
        ["description", "eventLinks"].includes(String(record(finding)?.check)),
      );
    if (
      ctx.input.scope === "current" &&
      (eventCheck ||
        atPath(raw, "description") ||
        atPath(raw, "shortDescription") ||
        atPath(raw, "event.website") ||
        Object.keys(record(atPath(raw, "event.socials")) ?? {}).length)
    ) {
      fail(`${owner}: Event fields are outside the assignment`);
    }
    if (owner === "location") {
      for (const slot of editionSlotNames) {
        if (!ctx.targets?.[slot] && atPath(raw, `decision.${slot}`) != null) {
          fail(
            "Location proposal for an absent target",
            undefined,
            "location_failed",
          );
        }
      }
    }
    if (
      owner === "classification" &&
      editionSlotNames.some(
        (slot) =>
          !ctx.targets?.[slot] && atPath(raw, `${slot}.classification`) != null,
      )
    ) {
      fail("Classification proposal for an absent target");
    }
    if (
      owner === "links" &&
      !ctx.targets?.currentOrNextEdition &&
      atPath(raw, "currentOrNextEdition") != null
    ) {
      fail("Link proposal for an absent target");
    }
  }

  private groupRule(
    group: ProposalGroup,
    raw: unknown,
    ctx: Context,
    available: Evidence[],
  ): string | undefined {
    const value = atPath(raw, group.rawPath);
    const slot = editionSlotNames.find((slot) =>
      group.path.startsWith(slot + "."),
    );
    try {
      if (group.owner === "location" && slot) {
        this.materializeLocation(raw, available, slot);
        return;
      }
      if (group.owner === "classification" && slot && value) {
        const target = ctx.targets?.[slot];
        if (target) {
          checkedClassification(
            target,
            value as NonNullable<
              NonNullable<ClassificationOutput[typeof slot]>["classification"]
            >,
            ctxEvent(ctx),
            ctx.context,
            { ...ctx.corpus, evidence: available },
          );
          return;
        }
      }
      const change = record(value);
      if (
        ["set", "clear"].includes(String(change?.action)) &&
        Array.isArray(change?.evidenceIds) &&
        change.evidenceIds.length === 0
      ) {
        return "Missing evidence reference";
      }
    } catch (error) {
      if (error instanceof LocationCountryConflictError) {
        throw new RepairFailure({
          code: "country_conflict",
          stage: "validation",
          editionKey: error.editionKey,
          field: "countryCode",
          message: error.message,
        });
      }
      return error instanceof Error
        ? error.message
        : `Invalid ${group.owner} group`;
    }
  }

  private checkLocationBoundary(
    raw: unknown,
    slot: (typeof editionSlotNames)[number],
  ) {
    const plan = atPath(raw, `decision.${slot}`);
    const input = this.location!.input;
    if (atPath(raw, "decision.status") !== "ready" || !record(plan)) {
      fail(
        "Location target does not match the accepted slot",
        undefined,
        "location_failed",
      );
    }
    const action = record(atPath(plan, "fields.countryCode"));
    if (
      input.countryBaseline &&
      action &&
      (action.action === "clear" ||
        (action.action === "set" &&
          typeof action.value === "string" &&
          action.value !== input.countryBaseline))
    ) {
      throw new RepairFailure({
        code: "country_conflict",
        stage: "validation",
        field: "countryCode",
        editionKey: input[slot]?.editionKey,
        message: "Location country conflicts with saved country",
      });
    }
    const coords = record(atPath(plan, "coordinates"));
    if (
      coords?.action === "reusePrevious" &&
      !this.location!.session.targets[slot]?.previousPointId
    ) {
      fail("Unknown Location point", undefined, "location_failed");
    }
  }

  materializeLocation(
    raw: unknown,
    evidence: Evidence[],
    only?: (typeof editionSlotNames)[number],
  ): MaterializedLocation {
    const { input, session } = this.location!;
    const supplied = new Set(input.evidence.map((item) => record(item)?.id));
    const enriched = {
      ...input,
      evidence: [
        ...input.evidence,
        ...evidence
          .filter(
            ({ id }) =>
              !supplied.has(id) &&
              this.passages.some((passage) => passage.id === id),
          )
          .map(({ id, quote }) => ({ id, quote })),
      ],
    };
    const decision = record(record(raw)?.decision);
    if (only) {
      const other = editionSlotNames.find((slot) => slot !== only)!;
      return validateLocation(
        { decision: { ...decision, [other]: null } },
        { ...enriched, [other]: null },
        session,
      );
    }
    return validateLocation(raw, enriched, session);
  }

  async general(
    owned: CatalogAttempt,
    data: IngestionData,
    signal: AbortSignal,
  ): Promise<StageResult<Targets & PlanDiagnostics> | undefined> {
    const raw = this.raw("general");
    if (!raw) {
      return;
    }
    const ctx = this.context(owned, data, null);
    if (
      festivalCountriesSchema.safeParse(record(raw)?.festivalCountries).success
    ) {
      const countries = checkRefreshCountries(
        raw as GeneralOutput,
        owned.input.mode,
        ctxEvent(ctx),
        ctx.corpus,
      );
      if (countries) {
        return countries;
      }
    }
    const groups = ownGroups(
      assignedGroups(owned.input.scope, raw as Targets),
      "general",
    );
    const issues = this.inspect(
      "general",
      raw,
      groups,
      ctx,
      ctx.corpus.evidence,
    );
    const provisional = structuredClone(raw);
    for (const { group, rule } of issues) {
      if (/\.(dates|year|scheduleStatus)$/.test(group.path)) {
        fail(`General temporal target: ${rule}`, group.path);
      }
      setPath(provisional, group.rawPath, undefined);
    }
    const parsed = this.replies.get("general")!.schema.safeParse(provisional);
    if (!parsed.success) {
      fail("Invalid General target");
    }
    const targets = validateGeneral(
      parsed.data as GeneralOutput,
      ctx.context,
      owned.input,
      ctx.corpus,
    );
    if (targets.status !== "continue" || !issues.length) {
      this.replies.get("general")!.raw = parsed.data;
      return targets;
    }
    const selected = targets.value;
    // The workflow checks the Edition gate before a return.
    const event = ctxEvent({ ...ctx, targets: selected });
    if (
      (!selected.previousEdition &&
        !selected.currentOrNextEdition &&
        !event?.editions.some(
          ({ scheduleStatus }) =>
            scheduleStatus === "scheduled" || scheduleStatus === "announced",
        )) ||
      (owned.input.scope === "current" && !selected.currentOrNextEdition)
    ) {
      return targets;
    }
    await this.dispatch(
      "general",
      this.validationRequests(issues),
      groups,
      { ...ctx, targets: selected },
      "validation",
      signal,
    );
    const output = this.raw("general") as GeneralOutput;
    data.general = { ...data.general, status: "success", output, errors: [] };
    return validateGeneral(
      output,
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
      const raw = this.raw(owner);
      if (raw) {
        issues.push(
          ...this.inspect(
            owner,
            raw,
            ownGroups(groups, owner),
            ctx,
            ctx.corpus.evidence,
          ),
        );
      }
    }
    await this.returnGroups(
      this.validationRequests(issues),
      groups,
      ctx,
      "validation",
      signal,
    );
    for (const owner of specialists) {
      const reply = this.replies.get(owner);
      if (reply) {
        reply.raw = reply.schema.parse(reply.raw);
      }
    }
  }

  async afterReview(
    owned: CatalogAttempt,
    data: IngestionData,
    targets: Targets,
    groups: ProposalGroup[],
    decisions: ReviewDecision[],
    signal: AbortSignal,
  ) {
    const byPath = new Map(groups.map((group) => [group.path, group]));
    await this.returnGroups(
      decisions.map(({ path, note }) => ({ group: byPath.get(path)!, note })),
      groups,
      this.context(owned, data, targets),
      "editor",
      signal,
    );
  }

  private context(
    owned: CatalogAttempt,
    data: IngestionData,
    targets: Targets | null,
  ): Context {
    return {
      corpus: this.corpus(data.corpus!),
      targets,
      context: data.context!,
      input: owned.input,
    };
  }

  private validationRequests(issues: GroupIssue[]): ReturnRequest[] {
    const rules = new Map<ProposalGroup, string[]>();
    for (const { group, rule } of issues) {
      const list = rules.get(group) ?? [];
      list.push(rule);
      rules.set(group, list);
    }
    return [...rules].map(([group, list]) => ({
      group,
      note: list.join("\n"),
    }));
  }

  private async returnGroups(
    requests: ReturnRequest[],
    groups: ProposalGroup[],
    ctx: Context,
    trigger: RepairRecord["trigger"],
    signal: AbortSignal,
  ) {
    const owners = new Set(requests.map(({ group }) => group.owner));
    for (const owner of owners) {
      await this.dispatch(
        owner,
        requests.filter(({ group }) => group.owner === owner),
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
    ctx: Context,
    trigger: RepairRecord["trigger"],
    signal: AbortSignal,
  ) {
    const original = this.replies.get(owner);
    const used = this.usedPaths;
    const records = requests.map(({ group, note }): RepairRecord => {
      const slot = editionSlotNames.find((slot) =>
        group.path.startsWith(slot + "."),
      );
      const target = {
        eventId: ctxEvent(ctx)?.id ?? null,
        ...(slot && { editionKey: ctx.targets?.[slot]?.editionKey }),
      };
      if (used.has(group.path)) {
        fail("Group already used its return", group.path);
      }
      used.add(group.path);
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
        fail(
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
            savedSearchInstructions,
          groups: records.map(({ path, note, original }) => ({
            path,
            note,
            original,
          })),
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
        fail(`${owner}: no usable revision`, records[0].path);
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
    ctx: Context,
  ) {
    for (const [index, { group }] of requests.entries()) {
      records[index].revision = atPath(revision, group.rawPath) ?? null;
    }
    const available = [...ctx.corpus.evidence, ...this.passages];
    const only = new Set(requests.map(({ group }) => group.path));
    const issues = this.inspect(owner, revision, groups, ctx, available, only);
    this.requireFixedTargets(owner, revision, ctx, available);
    if (issues.length) {
      this.failIssue(issues[0]);
    }
    const merged = structuredClone(original.raw);
    for (const [index, { group }] of requests.entries()) {
      const value = atPath(revision, group.rawPath);
      const entry = records[index];
      const support = new Set(references(value, "evidenceIds"));
      entry.evidence = available.filter(({ id }) => support.has(id));
      setPath(merged, group.rawPath, value);
      this.mergeQuestions(merged, revision, entry, value == null);
    }
    const checked = this.inspect(owner, merged, groups, ctx, available);
    if (checked.length) {
      this.failIssue(checked[0]);
    }
    this.requireFixedTargets(owner, merged, ctx, available);
    const parsed = original.schema.safeParse(merged);
    if (!parsed.success) {
      fail(`${owner}: invalid combined reply`, records[0].path);
    }
    original.raw = parsed.data;
  }

  private failIssue({ group, rule }: GroupIssue): never {
    if (group.owner === "location") {
      fail(rule, group.path, "location_failed");
    }
    fail(
      rule,
      group.path,
      group.owner === "classification" ? "invalid_plan" : "invalid_candidate",
    );
  }

  private requireFixedTargets(
    owner: GroupOwner,
    raw: unknown,
    ctx: Context,
    evidence: Evidence[],
  ) {
    if (owner !== "general") {
      return;
    }
    const targets = ctx.targets!;
    if (
      atPath(raw, "decision") !== "targets" ||
      atPath(raw, "eventId") !== targets.eventId ||
      atPath(raw, "observedEventName") !== targets.observedEventName ||
      editionSlotNames.some(
        (slot) =>
          atPath(raw, `${slot}.editionKey`) !== targets[slot]?.editionKey,
      )
    ) {
      fail("General changed the fixed identity or target");
    }
    const result = validateGeneral(raw as Targets, ctx.context, ctx.input, {
      ...ctx.corpus,
      evidence,
    });
    if (result.status !== "continue") {
      throw new RepairFailure(
        result.diagnostics.errors[0] ?? {
          code: "invalid_plan",
          stage: "validation",
          message: "General could not confirm the fixed targets",
        },
      );
    }
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
        fail(
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

type Context = {
  corpus: FrozenCorpus;
  targets: Targets | null;
  context: NonNullable<IngestionData["context"]>;
  input: CatalogAttempt["input"];
};

function ctxEvent(ctx: Context) {
  return ctx.context.catalog.find(
    ({ id }) => id === (ctx.input.eventId ?? ctx.targets?.eventId),
  );
}

export function repairDiagnostic(error: unknown) {
  if (error instanceof RepairFailure) {
    return error.diagnostic;
  }
  throw error;
}
