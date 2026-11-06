import { z } from "zod";

const model = "perplexity/pplx-decider-v1.2";
export const descriptionFields = ["description", "shortDescription"] as const;
type Field = (typeof descriptionFields)[number];
type FormatResult = number | "missing" | "not_applicable" | "unavailable";

export const minimumDescriptionFormat = 0.8;

export type DescriptionFormat = {
  model: string;
  fields: Record<Field, FormatResult>;
  error?: string;
};

const decisionResponse = z.object({
  model: z.string(),
  answers: z.record(z.string(), z.unknown()),
});
const yesNoAnswer = z.object({
  type: z.literal("noul"),
  noul: z.number().min(0).max(1),
});

export async function assessDescriptionFormat(
  reference: string | undefined,
  texts: Partial<Record<Field, string | null>> | undefined,
): Promise<DescriptionFormat> {
  const initial = reference ? "missing" : "not_applicable";
  const result: DescriptionFormat = {
    model,
    fields: { description: initial, shortDescription: initial },
  };
  if (!reference) {
    return result;
  }

  const state: { reference: string } & Partial<Record<Field, string>> = {
    reference,
  };
  const questions: Partial<
    Record<Field, { type: "noul"; instructions: string }>
  > = {};
  for (const field of descriptionFields) {
    const text = texts?.[field]?.trim();
    if (text) {
      state[field] = text;
      questions[field] = {
        type: "noul",
        instructions: `Does ${field} give a broadly accurate impression of the festival's current format compared with the reference?`,
      };
      result.fields[field] = "unavailable";
    }
  }
  if (!Object.keys(questions).length) {
    return result;
  }

  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    return { ...result, error: "OPENROUTER_API_KEY is missing" };
  }
  try {
    const response = await fetch("https://openrouter.ai/api/alpha/decisions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, state, questions }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return {
        ...result,
        error: `OpenRouter returned HTTP ${response.status}`,
      };
    }
    const decision = decisionResponse.parse(await response.json());
    result.model = decision.model;
    for (const field of descriptionFields) {
      if (questions[field]) {
        const answer = yesNoAnswer.safeParse(decision.answers[field]);
        if (answer.success) {
          result.fields[field] = answer.data.noul;
        } else {
          result.error = "OpenRouter returned an invalid or missing answer";
        }
      }
    }
    return result;
  } catch {
    return { ...result, error: "OpenRouter decision request failed" };
  }
}
