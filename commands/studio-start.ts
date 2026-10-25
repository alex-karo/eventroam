import { fileURLToPath } from "node:url";
import { startStudioServer } from "../src/mastra/server";

process.env.MASTRA_AUTO_DETECT_URL = "true";
const { mastra } = await import("../src/mastra");
await startStudioServer(
  mastra,
  undefined,
  fileURLToPath(new URL("../studio", import.meta.url)),
);
