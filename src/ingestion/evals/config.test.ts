import { expect, test } from "vitest";
import { evaluationConfig } from "./config";
import {
  createResearchModel,
  researchProviderOptions,
} from "../runtime/openrouter";

test("Go evals use their own key and override Location without OpenRouter options", () => {
  const config = evaluationConfig(
    { model: "opencode-go/gpt-6-luna" },
    {
      NODE_ENV: "test",
      OPENCODE_GO_KEY: " go-key ",
      CATALOG_LOCATION_MODEL: "other/model",
      OPENROUTER_SERVICE_TIER: "flex",
      OPENROUTER_REASONING_EFFORT: "medium",
    },
  );
  expect(config.apiKey).toBe("go-key");
  expect(config.locationModel).toBe(config.model);
  expect(config.serviceTier).toBeUndefined();
  const model = createResearchModel(config);
  expect(model.id).toBe("opencode-go/gpt-6-luna");
  expect(model.headers?.["x-opencode-session"]).toBeTruthy();
  expect(model.headers?.["User-Agent"]).toBe("eventroam-evals/1.0");
  expect(researchProviderOptions(config)).toEqual({
    openai: { reasoningEffort: "medium" },
    openrouter: {},
  });
});

test("Go evals cannot fall back to an OpenRouter key", () => {
  expect(() =>
    evaluationConfig(
      { model: "opencode-go/gpt-6-luna" },
      {
        NODE_ENV: "test",
        OPENROUTER_API_KEY: "router-key",
      },
    ),
  ).toThrow("OPENCODE_GO_KEY is required");
});

test("ordinary eval models retain OpenRouter routing", () => {
  const config = evaluationConfig(
    { model: "openai/gpt-6-luna" },
    {
      NODE_ENV: "test",
      OPENROUTER_API_KEY: "router-key",
      OPENCODE_GO_KEY: "go-key",
    },
  );
  expect(createResearchModel(config)).toEqual({
    id: "openrouter/openai/gpt-6-luna",
    apiKey: "router-key",
  });
  expect(researchProviderOptions(config)).not.toHaveProperty(
    "openrouter.service_tier",
  );
});
