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
  if (options.model?.startsWith("codex/")) {
    if (!options.model.slice("codex/".length).trim()) {
      throw new Error("CODEX_PROXY model name is required after codex/");
    }
    const key = env.CODEX_PROXY_KEY?.trim();
    if (!key) {
      throw new Error("CODEX_PROXY_KEY is required for Codex evals");
    }
    const baseUrl = env.CODEX_PROXY_URL?.trim() || "http://127.0.0.1:8317/v1";
    if (!URL.canParse(baseUrl)) {
      throw new Error("CODEX_PROXY_URL must be a valid HTTP(S) base URL");
    }
    const url = new URL(baseUrl);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error(
        "CODEX_PROXY_URL must be an HTTP(S) base URL without credentials, query or fragment",
      );
    }
    env.OPENROUTER_API_KEY = key;
    env.OPENROUTER_SERVICE_TIER = "standard";
    return {
      ...loadResearchConfig(env),
      codexProxyUrl: url.toString().replace(/\/$/, ""),
    };
  }
  return loadResearchConfig(env);
}
