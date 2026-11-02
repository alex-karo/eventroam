import { expect, test } from "vitest";
import { parse } from "yaml";
import { extractSource } from "./extract";

const url = "https://festival.example/";
const markdown = (html: string) =>
  extractSource(html, url, "text/html").markdown.replace(/\n{3,}/g, "\n\n");

test("navigation has an explicit end even without a main region", () => {
  const page = markdown(
    `<nav><a href="/tickets">Tickets</a></nav><p>Festival 2027</p>`,
  );
  expect(page).toBe(
    "<!-- Navigation -->\n\n[Tickets](https://festival.example/tickets)\n\n<!-- /Navigation -->\n\nFestival 2027",
  );
  expect(page).not.toContain("<!-- Main content -->");
});

test("inline links keep safe destinations and each label", () => {
  const result = extractSource(
    `<script type="application/ld+json">{"@type":"MusicEvent","url":"https://festival.example/tickets"}</script>
    <main><a href="/tickets">Tickets</a><a href="/tickets">Buy passes</a>
    <a href="javascript:alert(1)">Unsafe</a></main>`,
    url,
    "text/html",
  );
  expect(result).not.toHaveProperty("links");
  expect(result.markdown).toContain(
    "[Tickets](https://festival.example/tickets)",
  );
  expect(result.markdown).toContain(
    "[Buy passes](https://festival.example/tickets)",
  );
});

test("anchors without text use retained labels and safe destinations in order", () => {
  const page = markdown(`<main>
    <a href="/tickets?utm_source=home#buy" aria-label="Tickets 2027"><svg><title>Icon</title></svg></a>
    <a href="/tickets" title="Buy passes"><img src="/ticket.png"></a>
    <a href="/tickets" aria-label="Accessible label"><img alt="Ticket image" src="/ticket.png"></a>
    <a href="/tickets" aria-label="Other label" title="Other title">Ticket text</a>
    <a href="/faq"><img src="/faq.png"></a>
    <a href="/safe" aria-label="&lt;b&gt;Label&lt;/b&gt;"></a>
    <a href="javascript:alert(1)" aria-label="Unsafe"></a>
    <a href="https://user:pass@festival.example/" title="Credentials"></a>
    <a href="mailto:info@festival.example">Email</a>
    <a href="http://[" title="Malformed"></a>
    <a href="/hidden" hidden aria-label="Hidden link"></a>
    </main>`);
  const links = [
    "[Tickets 2027](https://festival.example/tickets?utm_source=home#buy)",
    "[Buy passes](https://festival.example/tickets)",
    "[Ticket image](https://festival.example/tickets)",
    '[Ticket text](https://festival.example/tickets "Other title")',
    "<https://festival.example/faq>",
  ];
  let previous = -1;
  for (const link of links) {
    expect(page).toContain(link);
    expect(page.indexOf(link)).toBeGreaterThan(previous);
    previous = page.indexOf(link);
  }
  expect(page).toContain("[\\<b>Label\\</b>](https://festival.example/safe)");
  for (const text of ["Unsafe", "Credentials", "Email", "Malformed"]) {
    expect(page).toContain(text);
  }
  for (const removed of [
    "javascript:",
    "user:pass",
    "mailto:",
    "http://[",
    "/hidden",
    ".png",
    "Accessible label",
  ]) {
    expect(page).not.toContain(removed);
  }
});

test.each([199, 200])(
  "metadata and new labels do not change the %i character render signal",
  (length) => {
    const body = "a".repeat(length);
    const result = extractSource(
      `<head><meta name="description" content="${"Metadata ".repeat(50)}"></head>
    <body><main>${body}<a href="/destination-with-a-long-label"></a>
    <a href="/tickets" aria-label="${"Tickets ".repeat(50)}"></a>
    <a href="/image"><img alt="${"Image ".repeat(50)}" src="/poster.jpg"></a></main>
    <script src="/app.js"></script></body>`,
      url,
      "text/html",
    );
    expect(result.nonNavigationTextLength).toBe(length);
    expect(result.needsJavascript).toBe(length < 200);
    expect(result.markdown).toContain(
      "https://festival.example/destination-with-a-long-label",
    );
    expect(result.markdown).toContain('description: "Metadata');
  },
);

test("a Wacken-style skip link identifies content and keeps nested headers local", () => {
  const page = markdown(`<a href="#page-content">Zum Hauptinhalt springen</a>
    <header><nav>Menu links</nav></header>
    <div id="page-content"><header><h2>Tickets</h2></header><p>28–31 July 2027</p></div>
    <footer>Contact</footer>`);
  expect(page).toContain(
    "<!-- Page header -->\n\n<!-- Navigation -->\n\nMenu links\n\n<!-- /Navigation -->\n\n<!-- /Page header -->",
  );
  expect(page).toContain(
    "<!-- Main content -->\n\n## Tickets\n\n28–31 July 2027\n\n<!-- /Main content -->",
  );
  expect(page).toContain(
    "<!-- Page footer -->\n\nContact\n\n<!-- /Page footer -->",
  );
  expect(page.match(/<!-- Page header -->/g)).toHaveLength(1);
});

test("explicit main and ARIA landmarks take precedence over skip links", () => {
  const page =
    markdown(`<a href="#other">Skip to content</a><div id="other">Other</div>
    <div role="main"><h1>Festival</h1><aside>Related links</aside></div>
    <div role="navigation">Navigation links</div>`);
  expect(page).toContain(
    "<!-- Main content -->\n\n# Festival\n\n<!-- Aside -->\n\nRelated links\n\n<!-- /Aside -->\n\n<!-- /Main content -->",
  );
  expect(page).toContain(
    "<!-- Navigation -->\n\nNavigation links\n\n<!-- /Navigation -->",
  );
  expect(page.match(/<!-- Main content -->/g)).toHaveLength(1);
});

test("missing or external skip targets and CSS names do not invent regions", () => {
  const page = markdown(`<a href="/other#content">Skip to content</a>
    <a href="#missing">Skip to content</a>
    <div id="content" class="main-content" data-source-region="Main content">Programme</div>
    <article><header><h2>News</h2></header></article>
    <nav hidden>Hidden links</nav><nav></nav>`);
  expect(page).not.toContain("<!-- Main content -->");
  expect(page).not.toContain("<!-- Page header -->");
  expect(page).not.toContain("<!-- Navigation -->");
  expect(page).toContain("## News");
});

test("sparse script-backed pages expose their non-navigation text length", () => {
  const result = extractSource(
    `<header><nav>${"Festival navigation ".repeat(30)}</nav></header>
    <main>Loading festival details</main><script src="/app.js"></script>`,
    url,
    "text/html",
  );
  expect(result.nonNavigationTextLength).toBe(
    "Loading festival details".length,
  );
  expect(result.needsJavascript).toBe(true);
});

test("short ordinary pages with scripts retain the existing sparse-page signal", () => {
  const result = extractSource(
    `<main>Festival dates and tickets</main><script src="/analytics.js"></script>`,
    url,
    "text/html",
  );
  expect(result.nonNavigationTextLength).toBeLessThan(200);
  expect(result.needsJavascript).toBe(true);
});

test("JSON-LD alone does not count as an application script", () => {
  const result = extractSource(
    `<script type="application/ld+json">{"@type":"MusicEvent","name":"Festival 2027"}</script>`,
    url,
    "text/html",
  );
  expect(result.needsJavascript).toBe(false);
  expect(result.markdown).toContain("Festival 2027");
});

test("head metadata keeps source fields and conflicting body dates", () => {
  const page = markdown(`<html><head><title>Festival 2027</title>
    <meta name="description" content="1–3 July 2027">
    <meta property="og:title" content="Tickets on sale">
    <meta property="og:description" content="Green Valley venue">
    <meta name="twitter:title" content="Festival news">
    <meta name="twitter:description" content="Programme details">
    <meta name="keywords" content="music, camping">
    <meta name="author" content="Festival team">
    <meta name="date" content="2026-10-28">
    </head><body><h2>Programme 2026</h2><h1>Festival news</h1>
    <p>Last year's festival ran in 2026.</p><iframe><title>Video service</title></iframe></body></html>`);
  expect(page).toMatch(/^---\n/);
  expect(parse(page.split("---")[1])).toEqual({
    title: "Festival 2027",
    meta: {
      description: "1–3 July 2027",
      "og:title": "Tickets on sale",
      "og:description": "Green Valley venue",
      "twitter:title": "Festival news",
      "twitter:description": "Programme details",
      keywords: "music, camping",
      author: "Festival team",
      date: "2026-10-28",
    },
  });
  expect(page).not.toContain("# Festival 2027");
  expect(page).toMatch(/^## Programme 2026\n[\s\S]*^# Festival news$/m);
  expect(page).toContain("Last year's festival ran in 2026.");
  expect(page).not.toContain('title: "Video service"');
});

test("repeated head fields keep the last nonempty value", () => {
  const page = markdown(`<head><meta name="description" content="Earlier dates">
    <meta name="description" content="Later dates"><meta name="description" content=""></head><body>Programme</body>`);
  expect(page).toContain('description: "Later dates"');
  expect(page).not.toContain("Earlier dates");
  expect(page).not.toContain("Page metadata");
});

test.each([
  `<main><h2>Festival</h2><title>Video service</title><meta name="description" content="Embedded claim"></main>`,
  `<main><h2>Festival</h2><iframe><title>Video service</title></iframe></main>`,
])("body and embedded titles do not become page metadata", (html) => {
  const page = markdown(html);
  expect(page).not.toMatch(/^---/);
  expect(page).not.toContain("# Video service");
  expect(page).toContain("## Festival");
});

test("table cell line breaks keep programme details in one row", () => {
  const page =
    markdown(`<table><thead><tr><th>Day</th><th>Programme</th><th>Stage</th></tr></thead>
    <tbody><tr><td>Friday</td><td><a href="/programme">Opening concert</a><br>18:00–19:00</td><td>Main stage</td></tr></tbody></table>`);
  const cells = page
    .split("\n")
    .find((line) => line.startsWith("| Friday"))!
    .split("|")
    .map((cell) => cell.trim());
  expect(cells[1]).toBe("Friday");
  expect(cells[2]).toContain(
    "[Opening concert](https://festival.example/programme)",
  );
  expect(cells[2]).toContain("18:00–19:00");
  expect(cells[3]).toBe("Main stage");
});

test("select options are omitted while ticket facts stay in one row", () => {
  const page = markdown(`<select><option>Other day</option></select>
    <table><thead><tr><th>Preiskategorie</th><th>Preis</th><th>Anzahl</th></tr></thead>
    <tbody><tr><td>Dauerkarte<br><small>Verfügbar bis Freitag</small></td>
    <td>199,00 €</td><td><select name="quantity">
    <option>1</option><option>2</option><option>3</option></select></td></tr></tbody></table>`);
  const cells = page
    .split("\n")
    .find((line) => line.startsWith("| Dauerkarte"))!
    .split("|")
    .map((cell) => cell.trim());
  expect(cells[1]).toContain("Dauerkarte");
  expect(cells[1]).toContain("Verfügbar bis Freitag");
  expect(cells[2]).toBe("199,00 €");
  expect(cells[3]).toBe("");
  expect(page).not.toContain("Other day");
});

test("empty nested regions are omitted and image alt keeps its time context", () => {
  const page =
    markdown(`<header><nav> </nav></header><main><aside><nav></nav></aside>
    <p><img alt="Festival site" src="/poster.jpg"> <time datetime="2027-07-01">Thursday</time></p></main>`);
  expect(page).not.toContain("<!-- Page header -->");
  expect(page).not.toContain("<!-- Navigation -->");
  expect(page).not.toContain("<!-- Aside -->");
  expect(page).toContain("<!-- Main content -->");
  expect(page).toContain("<!-- /Main content -->");
  expect(page).toContain("Festival site");
  expect(page).toContain("Thursday: 2027-07-01");
  expect(page).not.toContain("poster.jpg");
});

test("selection options are removed before link labels are flattened", () => {
  const page = markdown(`<table><tr><th>Ticket</th><th>Price</th></tr>
    <tr><td><a href="/tickets"><div>Weekend</div>
    <select><option>1</option><option>2</option><option>3</option></select>
    </a></td><td>€199</td></tr></table>`);
  expect(page).toContain(
    "| [Weekend](https://festival.example/tickets) | €199 |",
  );
});

test("map references keep lazy, noscript and anchor context in source order", () => {
  const result = extractSource(
    `<section><h2>Venue and parking</h2><p>Shuttle stop</p>
    <iframe src="about:blank" data-lazy-src="https://maps.google.com/maps?q=Azucarera" title="Azucarera de portas"></iframe>
    <a href="https://www.google.com/maps/d/edit?mid=festival">Site map</a>
    <noscript><iframe src="https://www.google.com/maps/d/embed?mid=festival" title="Fallback map"></iframe></noscript>
    <a href="https://maps.app.goo.gl/stop">Bus stop</a></section>`,
    url,
    "text/html",
  );
  expect(result.maps.map((ref) => ref.mid ?? ref.url)).toEqual([
    "https://maps.google.com/maps?q=Azucarera",
    "festival",
    "https://maps.app.goo.gl/stop",
  ]);
  expect(result.maps[0].context).toContain("Azucarera de portas");
  expect(result.maps[1].context).toContain("Fallback map");
  expect(result.maps[1].context).toContain("Site map");
  expect(result.markdown).not.toContain("Fallback map");
});

test("all image labels in an anchor stay available without media URLs", () => {
  const page = markdown(
    `<a href="/dates"><img alt="Festival" src="/logo.png"><img alt="20–23 August 2027" src="/dates.png"></a>`,
  );
  expect(page).toContain(
    "[Festival 20–23 August 2027](https://festival.example/dates)",
  );
  expect(page).not.toContain(".png");
});

test("empty-region cleanup keeps literal comments in metadata and code", () => {
  const html = `<head><meta name="description" content="Before &lt;!-- Aside --&gt; &lt;!-- /Aside --&gt; After"></head>
    <body><header><nav></nav></header><main><pre>&lt;!-- Aside --&gt; &lt;!-- /Aside --&gt;</pre></main></body>`;
  const page = markdown(html);
  expect(parse(page.split("---")[1]).meta.description).toBe(
    "Before <!-- Aside --> <!-- /Aside --> After",
  );
  expect(page).toContain("```\n<!-- Aside --> <!-- /Aside -->\n```");
  expect(page).not.toContain("<!-- Page header -->");
  expect(page).not.toContain("<!-- Navigation -->");
  expect(page).toContain("<!-- Main content -->");
  expect(markdown(html)).toBe(page);
});

test("adjacent calendar buttons keep separate day numbers", () => {
  const page = markdown(
    `<main><h2>October 2026</h2><div><button><abbr>27</abbr></button><button><abbr>28</abbr></button><button><abbr>29</abbr></button></div></main>`,
  );
  expect(page).toMatch(/27\s+28\s+29/);
  expect(page).not.toContain("272829");
});

test("structured coordinates stay with their owner and reject invalid pairs", () => {
  const body = JSON.stringify({
    "@type": "MusicEvent",
    name: "Festival",
    location: [
      { name: "Venue", geo: { latitude: "42.5", longitude: -8.6 } },
      {
        "@type": "Place",
        name: "Parking",
        geo: { latitude: 42.6, longitude: -8.7 },
      },
      { "@type": "Place", name: "Bad", geo: { latitude: 200, longitude: "" } },
    ],
  });
  const result = extractSource(body, url, "application/ld+json");
  const lines = result.markdown.split("\n\n");
  expect(lines.find((line) => line.includes("name: Venue"))).toContain(
    "latitude: 42.5 · longitude: -8.6",
  );
  expect(lines.find((line) => line.includes("name: Parking"))).toContain(
    "latitude: 42.6 · longitude: -8.7",
  );
  expect(lines.find((line) => line.includes("name: Bad"))).not.toContain(
    "latitude",
  );
  expect(result.markdown).toContain("location:");
});

test.each([
  '<section><h2>Parking 2024</h2><noscript><iframe src="https://www.google.com/maps/d/embed?mid=parking"></iframe></noscript></section>',
  '<h2>Parking 2024</h2><iframe src="https://www.google.com/maps/d/embed?mid=parking"></iframe>',
])("map context keeps the year for isolated iframe markup", (html) => {
  const result = extractSource(html, url, "text/html");
  expect(result.maps).toHaveLength(1);
  expect(result.maps[0].context).toContain("Parking 2024");
});
