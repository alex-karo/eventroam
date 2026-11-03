import { loadResearchConfig } from "../runtime/config";

export function evaluationConfig(
  options: { model?: string },
  environment: NodeJS.ProcessEnv = process.env,
) {
  const env = { ...environment };
  if (options.model) {
    env.OPENROUTER_MODEL = options.model;
    env.CATALOG_LOCATION_MODEL = options.model;
  }
  if (options.model?.startsWith("opencode-go/")) {
    const key = env.OPENCODE_GO_KEY?.trim();
    if (!key) {
      throw new Error("OPENCODE_GO_KEY is required for OpenCode Go evals");
    }
    env.OPENROUTER_API_KEY = key;
    env.OPENROUTER_SERVICE_TIER = "standard";
  }
  return loadResearchConfig(env);
}
