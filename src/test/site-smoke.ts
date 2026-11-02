import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { request } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { load } from "cheerio";
import {
  beginTestDatabase,
  endTestDatabase,
  testDatabase,
} from "@/test/database";
import { testFixtures } from "@/test/fixtures";
import { applyCatalogOperation } from "@/catalog/write/apply-operation";

const apex = "https://eventroam.org";
const festivals = "https://festivals.eventroam.org";
const crawler = "Twitterbot/1.0";

function httpGet(port: number, origin: string, path: string) {
  return new Promise<{
    status: number | undefined;
    body: string;
    contentType: string | undefined;
  }>((resolve, reject) => {
    const req = request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        headers: { host: new URL(origin).host, "user-agent": crawler },
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += String(chunk);
        });
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            body,
            contentType: res.headers["content-type"],
          }),
        );
        res.on("error", reject);
      },
    );
    req.setTimeout(10_000, () =>
      req.destroy(new Error("HTTP smoke request timed out")),
    );
    req.on("error", reject);
    req.end();
  });
}

async function availablePort() {
  const listener = createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const address = listener.address();
  assert(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    listener.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

function checkMetadata(html: string, url: string, title: string) {
  const $ = load(html);
  assert.equal($("title").text(), title);
  assert($("meta[name='description']").attr("content"));
  assert.equal($("link[rel='canonical']").attr("href"), url);
  assert.equal($("meta[property='og:url']").attr("content"), url);
  assert.equal($("meta[property='og:title']").attr("content"), title);
  assert.equal(
    $("meta[property='og:description']").attr("content"),
    $("meta[name='description']").attr("content"),
  );
  assert.equal($("meta[name='twitter:card']").attr("content"), "summary");
  assert.equal($("meta[name='twitter:title']").attr("content"), title);
  assert.equal(
    $("meta[name='twitter:description']").attr("content"),
    $("meta[name='description']").attr("content"),
  );
  assert.equal(
    $("meta[property='og:image'], meta[name='twitter:image']").length,
    0,
  );
  assert(!$("meta[name='robots']").attr("content")?.includes("noindex"));
  return $;
}

async function main() {
  beginTestDatabase();
  const database = testDatabase();
  const fx = testFixtures(database.client);
  const futureYear = new Date().getUTCFullYear() + 1;
  const published = fx.publishedEvent({
    event: { slug: "smoke-festival", canonicalName: "Smoke Festival" },
    editions: [
      {
        editionKey: "summer",
        editionYear: futureYear,
        startsOn: `${futureYear}-07-01`,
      },
    ],
  });
  fx.publishedEvent({
    event: {
      slug: "sparse-festival",
      canonicalName: "Sparse Festival",
      summary: null,
    },
    editions: [
      {
        editionKey: "2025",
        startsOn: "2025-07-01",
        locality: null,
        venueName: null,
        scheduleStatus: "cancelled",
      },
    ],
  });
  const draft = fx.event({
    slug: "private-value",
    canonicalName: "PRIVATE_VALUE",
  });
  fx.edition(draft);
  fx.eventLink(published.event, {
    official: false,
    url: "https://example.org/PRIVATE_VALUE",
  });
  const port = await availablePort();
  const server = spawn(process.execPath, [".next/standalone/server.js"], {
    env: {
      ...process.env,
      DATABASE_PATH: database.path,
      PUBLIC_APEX_ORIGIN: apex,
      PUBLIC_FESTIVALS_ORIGIN: festivals,
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  server.stdout.on("data", (chunk) => {
    output += String(chunk);
  });
  server.stderr.on("data", (chunk) => {
    output += String(chunk);
  });
  const get = async (origin: string, path: string) => {
    const response = await httpGet(port, origin, path);
    assert.equal(response.status, 200, `${origin}${path}: ${response.status}`);
    assert(!response.body.includes("PRIVATE_VALUE"));
    if (path === "/sitemap.xml") {
      assert.match(response.contentType ?? "", /application\/xml/);
    }
    if (path === "/robots.txt") {
      assert.match(response.contentType ?? "", /text\/plain/);
    }
    return response.body;
  };
  try {
    const deadline = Date.now() + 60_000;
    while (true) {
      assert.equal(server.exitCode, null, output);
      try {
        await get(apex, "/");
        break;
      } catch (error) {
        if (Date.now() >= deadline) {
          throw error;
        }
        await delay(200);
      }
    }
    const apexPage = checkMetadata(
      await get(apex, "/"),
      `${apex}/`,
      "Eventroam | A catalog of structured data",
    );
    const discoveryPage = checkMetadata(
      await get(festivals, "/"),
      `${festivals}/`,
      "Festivals | Eventroam",
    );
    const eventPage = checkMetadata(
      await get(festivals, "/events/smoke-festival?utm_source=smoke"),
      `${festivals}/events/smoke-festival`,
      "Smoke Festival | Eventroam",
    );
    const editionPage = checkMetadata(
      await get(
        festivals,
        "/events/smoke-festival/summer?view=map&utm_source=smoke",
      ),
      `${festivals}/events/smoke-festival/summer`,
      `Smoke Festival ${futureYear} | Scheduled | Eventroam`,
    );
    for (const origin of [apex, festivals]) {
      const privacy = checkMetadata(
        await get(origin, "/privacy"),
        `${origin}/privacy`,
        "Privacy policy | Eventroam",
      );
      assert.equal(privacy("h1").text(), "Privacy policy");
      assert(privacy("a[href='/privacy?analytics=off']").length > 0);
      assert(privacy("a[href='/privacy?analytics=basic']").length > 0);
    }
    for (const page of [apexPage, discoveryPage, eventPage, editionPage]) {
      assert.equal(page("a[href='/privacy']").length, 1);
    }
    assert.equal(
      (await httpGet(port, "https://unknown.example", "/privacy")).status,
      404,
    );
    const jsonLdSelector = "script[type='application/ld+json']";
    for (const page of [apexPage, discoveryPage, eventPage]) {
      assert.equal(page(jsonLdSelector).length, 0);
    }
    assert.equal(editionPage(jsonLdSelector).length, 1);
    const jsonLd = JSON.parse(editionPage(jsonLdSelector).text());
    assert.equal(jsonLd["@type"], "Event");
    assert.equal(jsonLd.url, `${festivals}/events/smoke-festival/summer`);
    const sparsePage = checkMetadata(
      await get(festivals, "/events/sparse-festival/2025"),
      `${festivals}/events/sparse-festival/2025`,
      "Sparse Festival 2025 | Cancelled · Past edition | Eventroam",
    );
    assert.equal(sparsePage(jsonLdSelector).length, 0);
    const filtered = load(await get(festivals, "/?country=PT"));
    assert.match(
      filtered("meta[name='robots']").attr("content") ?? "",
      /noindex, follow/,
    );
    for (const origin of [apex, festivals]) {
      const robots = await get(origin, "/robots.txt");
      assert.match(robots, /User-Agent: \*/i);
      assert.match(robots, /Allow: \//);
      assert(!robots.includes("Disallow:"));
      assert.deepEqual(
        robots.split("\n").filter((line) => line.startsWith("Sitemap:")),
        [`Sitemap: ${origin}/sitemap.xml`],
      );
    }
    const locations = (xml: string) =>
      load(xml, { xml: true })("loc")
        .map((_, node) => load(node).text())
        .get();
    assert.deepEqual(locations(await get(apex, "/sitemap.xml")), [
      `${apex}/`,
      `${apex}/privacy`,
    ]);
    assert.deepEqual(locations(await get(festivals, "/sitemap.xml")), [
      `${festivals}/`,
      `${festivals}/privacy`,
      `${festivals}/events/smoke-festival`,
      `${festivals}/events/smoke-festival/summer`,
      `${festivals}/events/sparse-festival`,
      `${festivals}/events/sparse-festival/2025`,
    ]);
    const unknown = await httpGet(
      port,
      "https://unknown.example",
      "/sitemap.xml",
    );
    assert.equal(unknown.status, 404);
    assert(!unknown.body.includes("<urlset"));
    applyCatalogOperation(database.client, {
      kind: "withdrawEdition",
      operationKey: "smoke:withdraw",
      actor: "owner",
      id: published.editions[0].id,
      expectedVersion: published.editions[0].version,
    });
    assert.deepEqual(locations(await get(festivals, "/sitemap.xml")), [
      `${festivals}/`,
      `${festivals}/privacy`,
      `${festivals}/events/sparse-festival`,
      `${festivals}/events/sparse-festival/2025`,
    ]);
    console.log("Public site HTTP smoke checks passed.");
  } catch (error) {
    console.error(output);
    throw error;
  } finally {
    const exited = once(server, "exit");
    server.kill("SIGTERM");
    await Promise.race([exited, delay(5_000, undefined, { ref: false })]);
    if (server.exitCode === null && server.signalCode === null) {
      server.kill("SIGKILL");
      await exited;
    }
    endTestDatabase();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
