import { z } from "zod";
import { bindEvidence } from "../evidence/contracts";
import { fixedReaderOutputSchema } from "./fixed-reader";
import { roleEvidenceTopics } from "../roles/contracts";
import { replyReferences } from "../roles/proposal-validation";
import { collectionOutputSchema } from "../roles/research/contracts";
import { generalOutputSchema } from "../roles/general/contracts";
import { ticketsOutputSchema } from "../roles/tickets/contracts";
import { classificationReplySchema } from "../roles/classification/contracts";
import { linksOutputSchema } from "../roles/links/contracts";
import type { ResearchDependencies } from "../contracts";
import type { PipelineEvalCase } from "./fixtures";

export const roleHandoffSchema = z.strictObject({
  schemaVersion: z.literal(6),
  provenance: z.string().min(1),
  pages: z
    .array(
      z.strictObject({
        url: z.url(),
        sourceId: z.string().min(1),
        reader: fixedReaderOutputSchema.optional(),
      }),
    )
    .min(1),
  collection: collectionOutputSchema,
  roles: z.strictObject({
    general: generalOutputSchema.optional(),
    tickets: ticketsOutputSchema.optional(),
    classification: classificationReplySchema.optional(),
    links: linksOutputSchema.optional(),
  }),
});

/** Check fixed citations before the CLI starts any model calls. */
export function assertEditorFixture(item: PipelineEvalCase) {
  const fixture = item.roleHandoff;
  if (!fixture) {
    return;
  }
  const evidence = fixture.pages.flatMap((page, index) => {
    const source = item.sources.find(
      (source) => source.attemptedUrl === page.url,
    );
    if (!source || page.sourceId !== `s${index + 1}`) {
      throw new Error(`${item.id}: invalid fixed source ${page.url}`);
    }
    if (source.status !== "ok") {
      if (page.reader) {
        throw new Error(`${item.id}: failed source has Reader output`);
      }
      return [];
    }
    if (!page.reader) {
      throw new Error(
        `${item.id}: missing fixed Reader output for ${page.url}`,
      );
    }
    const bound = bindEvidence(
      page.sourceId,
      source.markdown,
      page.reader,
      source.finalUrl,
    );
    if (bound.evidence.length !== page.reader.evidence.length) {
      throw new Error(`${item.id}: fixed quotation does not match ${page.url}`);
    }
    return bound.evidence;
  });
  const urls = fixture.pages.map((page) => page.url);
  const destinations = fixture.pages.map(
    (page) =>
      item.sources.find((source) => source.attemptedUrl === page.url)!.finalUrl,
  );
  const links = item.initial.event.links ?? [];
  const initial = (
    links.find((link) => link.kind === "official_site") ??
    links.find((link) => link.official) ??
    links[0]
  )?.url;
  if (
    new Set(urls).size !== urls.length ||
    new Set(destinations).size !== destinations.length ||
    (initial && urls[0] !== initial)
  ) {
    throw new Error(
      `${item.id}: fixed pages must start with the initial source`,
    );
  }
  const sources = new Set(fixture.pages.map((page) => page.sourceId));
  if (evidence.length && !fixture.roles.general) {
    throw new Error(`${item.id}: missing fixed General input`);
  }
  for (const finding of fixture.collection.checks) {
    if (finding.sourceIds.some((id) => !sources.has(id))) {
      throw new Error(`${item.id}: unknown fixed collection source`);
    }
  }
  for (const role of Object.keys(
    roleEvidenceTopics,
  ) as (keyof typeof roleEvidenceTopics)[]) {
    if (fixture.roles.general?.decision === "targets" && !fixture.roles[role]) {
      throw new Error(`${item.id}: missing fixed ${role} input`);
    }
    const topics: readonly string[] =
      role === "classification" && item.input.scope !== "current"
        ? [...roleEvidenceTopics.classification, "location"]
        : roleEvidenceTopics[role];
    const allowed = new Set(
      evidence
        .filter((item) => item.topics.some((topic) => topics.includes(topic)))
        .map((item) => item.id),
    );
    if (
      replyReferences(fixture.roles[role], "evidenceIds").some(
        (id) => typeof id !== "string" || !allowed.has(id),
      )
    ) {
      throw new Error(`${item.id}: unknown fixed ${role} citation`);
    }
  }
}

/** Replay Research and specialist replies for the Editor handoff. */
export function editorFixtureRoles(
  item: PipelineEvalCase,
): ResearchDependencies["generateRoles"] {
  const fixture = item.roleHandoff;
  if (!fixture) {
    return undefined;
  }
  return {
    research: async (_role, _prompt, context) => {
      const tool = context.tools?.inspectPage;
      if (!tool || !("execute" in tool) || !tool.execute) {
        throw new Error("Fixed Editor input requires inspectPage");
      }
      for (const page of fixture.pages) {
        const result = await tool.execute(
          { url: page.url },
          { abortSignal: context.abortSignal },
        );
        if (
          !result ||
          typeof result !== "object" ||
          !("sourceId" in result) ||
          result.sourceId !== page.sourceId
        ) {
          throw new Error(`${item.id}: fixed source order changed`);
        }
      }
      return structuredClone(fixture.collection);
    },
    ...Object.fromEntries(
      (
        Object.keys(roleEvidenceTopics) as (keyof typeof roleEvidenceTopics)[]
      ).map((role) => [
        role,
        async () => {
          const output = fixture.roles[role];
          if (!output) {
            throw new Error(`${item.id}: unexpected ${role} execution`);
          }
          return structuredClone(output);
        },
      ]),
    ),
  };
}
