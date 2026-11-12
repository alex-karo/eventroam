import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const runFile = promisify(execFile);
const composeFile = fileURLToPath(
  new URL("../../../compose.codex.yaml", import.meta.url),
);

const credentials = z.object({
  tokens: z.object({
    access_token: z.string().min(1),
    account_id: z.string().min(1),
    id_token: z.string().optional(),
  }),
});
const claims = z.object({ exp: z.number().int().positive().max(253402300799) });

function currentCodexToken(env: NodeJS.ProcessEnv) {
  const directory = env.CODEX_HOME?.trim() || join(homedir(), ".codex");
  try {
    const { tokens } = credentials.parse(
      JSON.parse(readFileSync(join(directory, "auth.json"), "utf8")),
    );
    const { exp } = claims.parse(
      JSON.parse(
        Buffer.from(tokens.access_token.split(".")[1], "base64url").toString(
          "utf8",
        ),
      ),
    );
    if (exp * 1000 <= Date.now() + 30_000) {
      throw new Error(
        "CODEX_PROXY local access token has expired. Use Codex to refresh your session, or run codex login, then retry.",
      );
    }
    return {
      type: "codex",
      access_token: tokens.access_token,
      account_id: tokens.account_id,
      ...(tokens.id_token && { id_token: tokens.id_token }),
      expired: new Date(exp * 1000).toISOString(),
      last_refresh: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("CODEX_PROXY")) {
      throw error;
    }
    throw new Error(
      "CODEX_PROXY cannot read a valid file-backed Codex login. Run codex -c 'cli_auth_credentials_store=\"file\"' login, then retry. CODEX_HOME can select another login directory.",
    );
  }
}

export async function prepareCodexProxy(
  options: { model?: string },
  environment: NodeJS.ProcessEnv = process.env,
) {
  const env = { ...environment };
  if (
    !options.model?.startsWith("codex/") ||
    env.CODEX_PROXY_URL?.trim() ||
    env.CODEX_PROXY_KEY?.trim()
  ) {
    return { environment: env, async [Symbol.asyncDispose]() {} };
  }
  if (!options.model.slice("codex/".length).trim()) {
    throw new Error("CODEX_PROXY model name is required after codex/");
  }
  // Read the current login each run. Codex remains the only session refresher.
  currentCodexToken(env);
  const directory = mkdtempSync(join(tmpdir(), "eventroam-codex-eval-"));
  const project = `eventroam-codex-${randomBytes(8).toString("hex")}`;
  const key = randomBytes(32).toString("hex");
  const controller = new AbortController();
  let pending: Promise<unknown> = Promise.resolve();
  let stopped: Promise<void> | undefined;
  let containerStarted = false;
  const composeEnvironment = {
    NODE_ENV: env.NODE_ENV,
    ...Object.fromEntries(
      Object.entries(process.env).filter(([name]) =>
        /^(PATH|HOME|TMPDIR|SystemRoot|DOCKER_.*|SSH_AUTH_SOCK|HTTPS?_PROXY|ALL_PROXY|NO_PROXY|https?_proxy|all_proxy|no_proxy|SSL_CERT_FILE|SSL_CERT_DIR)$/.test(
          name,
        ),
      ),
    ),
    EVENTROAM_CODEX_PROXY_DIRECTORY: directory,
  };
  const compose = (args: string[], cleanup = false) => {
    const command = runFile(
      "docker",
      [
        "compose",
        "--project-name",
        project,
        "--project-directory",
        directory,
        "--file",
        composeFile,
        ...args,
      ],
      {
        cwd: directory,
        env: composeEnvironment,
        timeout: cleanup ? 30_000 : 180_000,
        maxBuffer: 1024 * 1024,
        ...(cleanup ? {} : { signal: controller.signal }),
      },
    );
    if (!cleanup) {
      pending = command;
    }
    return command;
  };
  const interrupt = () => {
    void stop()
      .catch((error: Error) => {
        process.stderr.write(`${error.message}\n`);
      })
      .finally(() => process.kill(process.pid, "SIGINT"))
      .catch(() => {});
  };
  const terminate = () => {
    void stop()
      .catch((error: Error) => {
        process.stderr.write(`${error.message}\n`);
      })
      .finally(() => process.kill(process.pid, "SIGTERM"))
      .catch(() => {});
  };

  function stop() {
    if (stopped) {
      return stopped;
    }
    stopped = (async () => {
      controller.abort();
      try {
        await pending.catch(() => {});
        if (containerStarted) {
          await compose(["down", "--timeout", "1", "--remove-orphans"], true);
        }
      } catch {
        throw new Error(
          `CODEX_PROXY could not remove Docker project ${project}. Start Docker and remove containers with label com.docker.compose.project=${project}.`,
        );
      } finally {
        rmSync(directory, { recursive: true, force: true });
        process.removeListener("SIGINT", interrupt);
        process.removeListener("SIGTERM", terminate);
      }
    })();
    return stopped;
  }

  process.on("SIGINT", interrupt);
  process.on("SIGTERM", terminate);
  try {
    const authDirectory = join(directory, "auth");
    mkdirSync(authDirectory, { mode: 0o700 });
    writeFileSync(
      join(directory, "config.json"),
      JSON.stringify({
        "config-version": 8,
        server: { host: "0.0.0.0", port: 8317 },
        access: { "api-keys": [key] },
        oauth: { "auth-dir": "/run/eventroam/auth" },
        management: { "disable-control-panel": true },
        routing: { retry: { "request-retry": 0 } },
        observability: { logs: { "request-log": false } },
      }),
      { mode: 0o600 },
    );
    await compose(["pull", "--policy", "missing", "--quiet"]);
    // Read again after a possible image download. Codex owns session refresh.
    writeFileSync(
      join(authDirectory, "codex.json"),
      JSON.stringify(currentCodexToken(env)),
      { mode: 0o600 },
    );
    containerStarted = true;
    await compose(["up", "--detach", "--pull", "never"]);
    const { stdout } = await compose(["port", "codex-proxy", "8317"]);
    const address = stdout.trim();
    if (!/^127\.0\.0\.1:\d+$/.test(address)) {
      throw new Error("invalid proxy address");
    }
    const url = `http://${address}/v1`;
    const deadline = Date.now() + 30_000;
    while (!controller.signal.aborted && Date.now() < deadline) {
      try {
        const response = await fetch(`${url}/models`, {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(500),
          ]),
        });
        await response.body?.cancel();
        if (response.ok) {
          return {
            environment: { ...env, CODEX_PROXY_URL: url, CODEX_PROXY_KEY: key },
            [Symbol.asyncDispose]: stop,
          };
        }
      } catch {
        // The container can need time to start its HTTP listener.
      }
      await delay(100, undefined, { signal: controller.signal });
    }
    throw new Error("proxy not ready");
  } catch (error) {
    await stop();
    if (error instanceof Error && error.message.startsWith("CODEX_PROXY")) {
      throw error;
    }
    throw new Error(
      "CODEX_PROXY Docker Compose setup failed. Check that Docker is running, Docker Compose is installed, and the image registry is reachable, then retry.",
    );
  }
}
