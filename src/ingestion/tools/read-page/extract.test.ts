import { expect, test } from "vitest";
import { extractSource } from "./extract";

const url = "https://festival.example/";
const markdown = (html: string) =>
  extractSource(html, url, "text/html").markdown;

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

test("200 body characters clear the sparse-page signal", () => {
  const result = extractSource(
    `<main>${"a".repeat(200)}</main><script src="/app.js"></script>`,
    url,
    "text/html",
  );
  expect(result.nonNavigationTextLength).toBe(200);
  expect(result.needsJavascript).toBe(false);
});

test("table cell line breaks keep programme details in one row", () => {
  const page =
    markdown(`<table><thead><tr><th>Day</th><th>Programme</th><th>Stage</th></tr></thead>
    <tbody><tr><td>Friday</td><td>Opening concert<br>18:00–19:00</td><td>Main stage</td></tr></tbody></table>`);
  expect(page).toContain(
    "| Friday | Opening concert; 18:00–19:00 | Main stage |",
  );
});

test("select options are omitted while ticket facts stay in one row", () => {
  const page = markdown(`<select><option>Other day</option></select>
    <table><thead><tr><th>Preiskategorie</th><th>Preis</th><th>Anzahl</th></tr></thead>
    <tbody><tr><td>Dauerkarte<br><small>Verfügbar bis Freitag</small></td>
    <td>199,00 €</td><td><select name="quantity">
    <option>1</option><option>2</option><option>3</option></select></td></tr></tbody></table>`);
  expect(page).toContain("| Dauerkarte; Verfügbar bis Freitag | 199,00 € |  |");
  expect(page).not.toContain("Other day");
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
