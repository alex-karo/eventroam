import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { SqliteError, type Database } from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type {
  CatalogEdit,
  CatalogEditTarget,
} from "@/catalog/operations/direct-edit";
import { catalogPriceBlockSchema } from "@/catalog/operations/operation";
import { editionTerms, externalLinks } from "@/db/schema";
import {
  applyApprovedCatalogItem,
  editionRow,
  eventRow,
  normalizedPriceDetails,
  type ApprovedEditStep,
} from "./apply-operation";

type Fields = Record<string, { before: unknown; after: unknown }>;
type Link = Pick<
  typeof externalLinks.$inferSelect,
  "id" | "kind" | "url" | "label" | "official"
>;

function targetLinks(client: Database, target: CatalogEditTarget): Link[] {
  return drizzle(client)
    .select({
      id: externalLinks.id,
      kind: externalLinks.kind,
      url: externalLinks.url,
      label: externalLinks.label,
      official: externalLinks.official,
    })
    .from(externalLinks)
    .where(
      eq(
        target.kind === "event"
          ? externalLinks.eventId
          : externalLinks.editionId,
        target.id,
      ),
    )
    .all();
}

function storedPrice(row: ReturnType<typeof editionRow>) {
  return catalogPriceBlockSchema.parse({
    basePrice:
      row.priceKind === null
        ? null
        : {
            kind: row.priceKind,
            minMinor: row.priceMinMinor,
            maxMinor: row.priceMaxMinor,
            coverage: row.priceCoverage,
            ...(row.priceCurrency === null
              ? {}
              : { currency: row.priceCurrency }),
            ...(row.priceQualification === null
              ? {}
              : { qualification: row.priceQualification }),
          },
    priceDetails: row.priceDetails,
  });
}

function verifyBefore(changes: Fields, current: Record<string, unknown>) {
  for (const [key, { before }] of Object.entries(changes)) {
    if (!isDeepStrictEqual(before, current[key])) {
      throw new Error(
        `Check the current value of ${key} before proposing this edit`,
      );
    }
  }
}

function verifyEditionBefore(
  client: Database,
  target: Extract<CatalogEditTarget, { kind: "edition" }>,
) {
  const row = editionRow(client, target.id);
  const { price, termIds, ...fields } = target.changes;
  verifyBefore(fields, row);
  if (price) {
    verifyBefore({ price }, { price: storedPrice(row) });
    if (
      normalizedPriceDetails(price.after.priceDetails).length !==
      price.after.priceDetails.length
    ) {
      throw new Error("Use distinct price details");
    }
  }
  if (termIds) {
    const ids = drizzle(client)
      .select({ id: editionTerms.termId })
      .from(editionTerms)
      .where(eq(editionTerms.editionId, target.id))
      .orderBy(editionTerms.termId)
      .all()
      .map(({ id }) => id);
    verifyBefore({ termIds }, { termIds: ids });
  }
}

export function verifyEditPreview(client: Database, edit: CatalogEdit) {
  for (const target of edit.targets) {
    if (target.kind === "event") {
      verifyBefore(target.changes, eventRow(client, target.id));
    } else {
      verifyEditionBefore(client, target);
    }
    if (target.links) {
      const links = targetLinks(client, target);
      for (const edit of target.links) {
        const link = links.find(({ id }) => id === edit.id);
        if (!link) {
          throw new Error("The link does not belong to this target");
        }
        verifyBefore(edit.changes, link);
      }
    }
  }
}

function afterValues<T extends Fields>(changes: T) {
  return Object.fromEntries(
    Object.entries(changes).map(([field, { after }]) => [field, after]),
  ) as { [K in keyof T]: NonNullable<T[K]>["after"] };
}

function resolveLinks(client: Database, target: CatalogEditTarget) {
  const edits = new Map(target.links?.map((link) => [link.id, link.changes]));
  const links = targetLinks(client, target).map(({ id, ...link }) => {
    const edit = edits.get(id);
    edits.delete(id);
    return edit ? { ...link, ...afterValues(edit) } : link;
  });
  if (edits.size) {
    throw new Error("An edited link no longer belongs to this target");
  }
  return links;
}

function targetSteps(
  client: Database,
  target: CatalogEditTarget,
  prefix: string,
) {
  const { id } = target;
  const steps: ApprovedEditStep[] = [];
  const add = (slot: string, resolve: ApprovedEditStep["resolve"]) => {
    steps.push({ key: `${prefix}:${slot}`, resolve });
  };
  if (target.kind === "event") {
    if (Object.keys(target.changes).length) {
      add("fields", () => ({
        kind: "updateEvent",
        id,
        data: afterValues(target.changes),
      }));
    }
  } else {
    const { price, termIds, ...fields } = target.changes;
    if (Object.keys(fields).length) {
      add("fields", () => ({
        kind: "updateEdition",
        id,
        data: afterValues(fields),
      }));
    }
    if (price) {
      add("price", () => ({
        kind: "replacePriceBlock",
        id,
        ...price.after,
      }));
    }
    if (termIds) {
      add("terms", () => ({
        kind: "replaceTerms",
        id,
        termIds: termIds.after,
      }));
    }
  }
  if (target.links) {
    add("links", () => ({
      kind: "replaceLinks",
      owner: { type: target.kind, id },
      links: resolveLinks(client, target),
    }));
  }
  return steps;
}

export function catalogEditFailure(error: unknown) {
  if (error instanceof SqliteError) {
    return error.code === "SQLITE_CONSTRAINT_UNIQUE"
      ? "A catalog record already uses that value"
      : "The catalog database could not complete the edit";
  }
  if (error instanceof Error && !(error.cause instanceof SqliteError)) {
    return error.message;
  }
  return "The catalog database could not complete the edit";
}

export function applyCatalogEdit(
  client: Database,
  edit: CatalogEdit,
  pair: { runId: string; toolCallId: string },
) {
  const runKey = createHash("sha256")
    .update(JSON.stringify([pair.runId, pair.toolCallId]))
    .digest("hex");

  return edit.targets.map((target, index) => {
    const subject = { kind: target.kind, id: target.id };
    try {
      const steps = targetSteps(
        client,
        target,
        `studio-edit:${runKey}:${index}`,
      );
      const results = applyApprovedCatalogItem(
        client,
        steps,
        target,
        edit.auditMode,
      );
      return {
        ...subject,
        status: results.some(({ changed }) => changed)
          ? ("changed" as const)
          : ("unchanged" as const),
      };
    } catch (error) {
      return {
        ...subject,
        status: "failed" as const,
        reason: catalogEditFailure(error),
      };
    }
  });
}
