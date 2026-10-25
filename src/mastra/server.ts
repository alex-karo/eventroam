import type { Mastra } from "@mastra/core/mastra";
import { createNodeServer } from "@mastra/deployer/server";

/** Use Mastra's production HTTP server and shutdown for hosted and offline runs. */
export function startStudioServer(
  mastra: Mastra,
  listener = { host: "0.0.0.0", port: 4111 },
  studioPath?: string,
) {
  process.env.MASTRA_AUTO_DETECT_URL = "true";
  if (studioPath) {
    process.env.MASTRA_STUDIO_PATH = studioPath;
  }
  mastra.setServer({ ...mastra.getServer(), ...listener });
  return createNodeServer(mastra, {
    tools: {},
    isDev: false,
    studio: Boolean(studioPath),
    browserStream: false,
  });
}
