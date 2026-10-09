import { z } from "zod";
import { currency } from "@/catalog/domain/price";
import { isAssignedCountryCode } from "@/catalog/domain/country-codes";
import {
  scheduleStatuses,
  ticketAvailabilities,
} from "@/catalog/domain/vocabulary";
import { normalizeCatalogUrl } from "@/catalog/domain/urls";
import { majorToMinor } from "./money";

const editionKey = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(63);
const boundedMessage = z.string().trim().min(1).max(500);
const url = z
  .url()
  .refine((value) => /^https?:\/\//.test(value), "HTTP(S) URL required");
const optionalLink = z.union([url, z.literal("")]).optional();
const fact = <T extends z.ZodType>(value: T) =>
  z.object({ value, reason: boundedMessage }).strict();
const nullableText = (max: number) =>
  z.string().trim().min(1).max(max).nullable();
const amount = z.number().nonnegative();
const monetaryAmount = (code: string, value: number) => {
  try {
    majorToMinor(value, code);
    return true;
  } catch {
    return false;
  }
};

const dateBlock = z
  .object({
    startsOn: z.iso.date(),
    endsOn: z.iso.date(),
    state: z.enum(["provisional", "confirmed"]),
  })
  .strict()
  .refine(
    (value) => value.endsOn >= value.startsOn,
    "End date precedes start date",
  );
const coordinateBlock = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    precision: z.enum(["exact", "approximate", "locality", "region"]),
  })
  .strict();
const paidBase = z
  .object({
    kind: z.enum(["exact", "from", "range"]),
    currency,
    minAmount: amount,
    maxAmount: amount,
    coverage: z.literal("full_programme"),
    qualification: z.string().trim().min(1).max(500).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.kind === "range"
        ? value.maxAmount <= value.minAmount
        : value.maxAmount !== value.minAmount
    ) {
      ctx.addIssue({ code: "custom", message: "Invalid base price bounds" });
    }
    for (const field of ["minAmount", "maxAmount"] as const) {
      if (!monetaryAmount(value.currency, value[field])) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: "Invalid currency precision or amount range",
        });
      }
    }
  });
const freeBase = z
  .object({
    kind: z.literal("free"),
    coverage: z.literal("full_programme"),
    qualification: z.string().trim().min(1).max(500).optional(),
  })
  .strict();
export const researchBasePriceSchema = z.union([freeBase, paidBase]);
export const ticketVariantSchema = z
  .object({
    label: z.string().trim().min(1).max(250),
    amount: amount.optional(),
    currency: currency.optional(),
    terms: z.string().trim().min(1).max(1000).optional(),
    availability: z.enum(ticketAvailabilities).optional(),
    url: url.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if ((value.amount === undefined) !== (value.currency === undefined)) {
      ctx.addIssue({
        code: "custom",
        message: "Amount and currency must be supplied together",
      });
    }
    if (
      value.amount !== undefined &&
      value.currency !== undefined &&
      !monetaryAmount(value.currency, value.amount)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: "Invalid currency precision or amount range",
      });
    }
  });
const ticketBlock = z
  .object({
    variants: z.array(ticketVariantSchema).max(100),
    basePrice: researchBasePriceSchema
      .nullable()
      .describe(
        "Full-programme base price excluding eligibility-restricted concessions, including free child, youth, student, senior, or resident tickets. Keep concessions in variants; use null when only concession prices are known.",
      ),
  })
  .strict();
const socialLinks = z
  .object({
    instagram: optionalLink,
    facebook: optionalLink,
    youtube: optionalLink,
    tiktok: optionalLink,
    x: z
      .union([
        z.literal(""),
        url.refine(
          (value) =>
            URL.canParse(value) &&
            ["x.com", "twitter.com", "www.x.com", "www.twitter.com"].includes(
              new URL(value).hostname.toLowerCase(),
            ),
          "X/Twitter account URL required",
        ),
      ])
      .optional(),
    other: optionalLink,
  })
  .strict();
const edition = z
  .object({
    key: editionKey,
    year: fact(z.number().int().min(1).max(9999)).optional(),
    dates: fact(dateBlock.nullable()).optional(),
    scheduleStatus: fact(z.enum(scheduleStatuses)).optional(),
    displayName: fact(nullableText(250)).optional(),
    venueName: fact(nullableText(250)).optional(),
    venueAddress: fact(nullableText(500)).optional(),
    locality: fact(nullableText(250)).optional(),
    administrativeArea: fact(nullableText(250)).optional(),
    countryCode: fact(
      z
        .string()
        .regex(/^[A-Z]{2}$/)
        .refine(isAssignedCountryCode)
        .nullable(),
    ).optional(),
    coordinates: fact(coordinateBlock.nullable()).optional(),
    capacityEstimate: fact(z.number().int().positive().nullable()).optional(),
    classification: z
      .object({
        add: fact(z.array(z.string().min(1)).max(50)).optional(),
        remove: fact(z.array(z.string().min(1)).max(50)).optional(),
      })
      .strict()
      .optional(),
    tickets: fact(ticketBlock).optional(),
    links: z.object({ tickets: optionalLink }).strict(),
  })
  .strict();

export const researchDataSchema = z
  .object({
    eventId: z.string().min(1).optional(),
    eventName: z
      .string()
      .max(250)
      .refine((value) => value.trim().length > 0, "Event name required"),
    reason: boundedMessage.optional(),
    sources: z.array(z.object({ url, information: boundedMessage }).strict()),
    summary: fact(z.string().max(2000)).optional(),
    links: z.object({ website: optionalLink, socials: socialLinks }).strict(),
    editions: z.array(edition).max(20),
  })
  .strict()
  .superRefine((data, ctx) => {
    const keys = new Set<string>();
    for (const [index, item] of data.editions.entries()) {
      if (keys.has(item.key)) {
        ctx.addIssue({
          code: "custom",
          path: ["editions", index, "key"],
          message: "Duplicate edition key",
        });
      }
      keys.add(item.key);
    }
    const urls = new Set<string>();
    for (const [index, item] of data.sources.entries()) {
      if (!URL.canParse(item.url)) {
        continue;
      }
      const normalized = normalizeCatalogUrl(item.url);
      if (urls.has(normalized)) {
        ctx.addIssue({
          code: "custom",
          path: ["sources", index, "url"],
          message: "Duplicate source URL",
        });
      }
      urls.add(normalized);
    }
  });

export const researchQuestionSchema = z
  .object({
    message: boundedMessage.describe(
      "Describe the unknown question. For partial, name the unfinished core check and its cause; merely unpublished or optional details do not require partial.",
    ),
    editionKey: editionKey.optional(),
    field: z.string().min(1).max(100).optional(),
  })
  .strict();
export const modelResearchErrorSchema = z
  .object({
    code: z.enum([
      "source_unavailable",
      "source_unsupported",
      "source_blocked",
      "limit_reached",
    ]),
    message: boundedMessage,
    url: url.optional(),
    editionKey: editionKey.optional(),
    field: z.string().min(1).max(100).optional(),
  })
  .strict();
export const researchCandidateSchema = z
  .object({
    status: z
      .enum(["success", "partial", "failed"])
      .describe(
        "Research completion: success when relevant checks are complete even if the next edition announcement lacks details; partial only for useful source findings with an unfinished core check; failed with data:null and a source error when refresh/check has no usable inspected-source findings. Repeating saved/input identity, facts, or URLs is not a finding; verified unchanged facts count. Duplicate add may use a matching supplied catalog identity alone.",
      ),
    data: researchDataSchema.nullable(),
    errors: z.array(modelResearchErrorSchema).max(30),
    unresolved: z
      .array(researchQuestionSchema)
      .max(30)
      .describe(
        "Unanswered questions; partial requires at least one specific unfinished core check and its cause. Optional unknowns may coexist with success.",
      ),
  })
  .strict()
  .superRefine((candidate, ctx) => {
    if (
      candidate.status === "failed"
        ? candidate.data !== null
        : candidate.data === null
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["data"],
        message: "Status and data disagree",
      });
    }
    if (candidate.status === "partial" && candidate.unresolved.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["unresolved"],
        message: "Partial research needs an unresolved question",
      });
    }
    if (
      candidate.status === "failed" &&
      candidate.errors.length + candidate.unresolved.length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["errors"],
        message: "Failed research needs a diagnostic",
      });
    }
  });

export type ResearchCandidate = z.infer<typeof researchCandidateSchema>;
export type ResearchStatus = ResearchCandidate["status"];
export type ResearchData = z.infer<typeof researchDataSchema>;
export type ResearchQuestion = z.infer<typeof researchQuestionSchema>;
export type ResearchError = {
  code:
    | z.infer<typeof modelResearchErrorSchema>["code"]
    | "model_failed"
    | "invalid_candidate"
    | "write_failed"
    | "workflow_failed"
    | "run_persistence_failed";
  message: string;
  stage: "source" | "research" | "validation" | "write" | "workflow";
  url?: string;
  editionKey?: string;
  field?: string;
  diagnostic?: {
    errorTypes: string[];
    httpStatus?: number;
    providerCode?: string | number;
    retryable?: boolean;
  };
};
export const RESEARCH_PROMPT_VERSION = "model-direct-v5";
