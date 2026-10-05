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
