// Use the same HTTP server as the CLI, without rebuilding the fixture in each test.
import { startStudioServer } from "../../mastra/server";
import { createFixtureMastra } from "./mastra";

createFixtureMastra().then((mastra) =>
  startStudioServer(mastra, {
    host: "127.0.0.1",
    port: Number(process.env.STUDIO_FIXTURE_PORT ?? 4111),
  }),
);
