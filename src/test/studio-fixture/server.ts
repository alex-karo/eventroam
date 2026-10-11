// Use the same HTTP server as the CLI, without rebuilding the fixture in each test.
import { createNodeServer } from "@mastra/deployer/server";
import { createFixtureMastra } from "./mastra";

createFixtureMastra().then((mastra) =>
  createNodeServer(mastra, { tools: {}, isDev: true }),
);
