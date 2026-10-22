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
    "[Navigation]\n\n[Tickets](https://festival.example/tickets)\n\n[/Navigation]\n\nFestival 2027",
  );
  expect(page).not.toContain("[Main content]");
});

test("links keep each safe URL once even when labels differ", () => {
  const result = extractSource(
    `<script type="application/ld+json">{"@type":"MusicEvent","url":"https://festival.example/tickets"}</script>
    <main><a href="/tickets">Tickets</a><a href="/tickets">Buy passes</a>
    <a href="javascript:alert(1)">Unsafe</a></main>`,
    url,
    "text/html",
  );
  expect(result.links).toEqual(["https://festival.example/tickets"]);
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
    "[Page header]\n\n[Navigation]\n\nMenu links\n\n[/Navigation]\n\n[/Page header]",
  );
  expect(page).toContain(
    "[Main content]\n\n## Tickets\n\n28–31 July 2027\n\n[/Main content]",
  );
  expect(page).toContain("[Page footer]\n\nContact\n\n[/Page footer]");
  expect(page.match(/\[Page header\]/g)).toHaveLength(1);
});

test("explicit main and ARIA landmarks take precedence over skip links", () => {
  const page =
    markdown(`<a href="#other">Skip to content</a><div id="other">Other</div>
    <div role="main"><h1>Festival</h1><aside>Related links</aside></div>
    <div role="navigation">Navigation links</div>`);
  expect(page).toContain(
    "[Main content]\n\n# Festival\n\n[Aside]\n\nRelated links\n\n[/Aside]\n\n[/Main content]",
  );
  expect(page).toContain("[Navigation]\n\nNavigation links\n\n[/Navigation]");
  expect(page.match(/\[Main content\]/g)).toHaveLength(1);
});

test("missing or external skip targets and CSS names do not invent regions", () => {
  const page = markdown(`<a href="/other#content">Skip to content</a>
    <a href="#missing">Skip to content</a>
    <div id="content" class="main-content" data-source-region="Main content">Programme</div>
    <article><header><h2>News</h2></header></article>
    <nav hidden>Hidden links</nav><nav></nav>`);
  expect(page).not.toContain("[Main content]");
  expect(page).not.toContain("[Page header]");
  expect(page).not.toContain("[Navigation]");
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

test("ticket table keeps price with category without quantity choices", () => {
  const page =
    markdown(`<table><thead><tr><th>Preiskategorie</th><th>Preis</th><th>Anzahl</th></tr></thead>
    <tbody><tr><td>Dauerkarte<br><small>Verfügbar bis Freitag</small></td>
    <td>199,00 €</td><td><select class="variant-quantity" name="quantity">
    <option>1</option><option>2</option><option>3</option></select></td></tr></tbody></table>`);
  expect(page).toContain("| Dauerkarte; Verfügbar bis Freitag | 199,00 € |  |");
  expect(page).not.toContain("123");
});
