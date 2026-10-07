# Eventroam

Eventroam is a worldwide discovery platform for open-air music festivals and burning-like gatherings. It combines map and list exploration with an AI research agent that finds source information and helps maintain the catalog through validated, owner-initiated updates.

## Product idea

An **Event** is a continuing identity; each edition is a separate **Occurrence** with its own dates, location, status, and classifications. This preserves history when plans change.

Visitors can filter by date, place, genre, duration, and size, share searches through URLs, and open stable event and edition pages. The map and list use the same results; editions without coordinates remain discoverable in the list.

## Architecture

Eventroam is one Next.js application and one SQLite catalog. Scope hosts share the application and database: the apex host is a directory, while the Festivals host serves discovery and record pages.

```text
Local research CLI ──> source reader + research agent
                              │ proposed facts
                              v
                      operation adapter ──> catalog writer ──> SQLite
Fixture and migration commands ───────────────────────────────> SQLite
Next.js pages and read endpoints <──── public catalog reads <── SQLite
              │
              └──> browser discovery UI ──> optional Mapbox map
```

- **Public reads:** Next.js server components render the scope directory, discovery, and event/edition pages. Same-origin endpoints return discovery summaries and selected edition details. Public queries enforce publication rules; browser code receives public data contracts, not database rows.
- **Discovery:** the server supplies the complete set of public summaries for the active scope. Shared pure rules filter and order editions on initial rendering and in the browser. The list and map consume those same results; full details load when an edition is selected.
- **Catalog research and writes:** a local CLI can add, refresh, or check events. A research agent searches and reads sources, then proposes edition-specific facts. An adapter checks the proposal's structure and requested targets; a framework-independent writer enforces data and publication rules, versions, replay protection, and atomic audit records. Runs preview and roll back by default; `--apply` starts fresh research and saves eligible changes. Factual interpretation is model-led, and refreshes are not scheduled. Migrations and fictional fixtures use separate commands.
- **Boundaries:** routes compose features; catalog domain and filtering rules remain independent of React, Next.js, and storage. ESLint checks import boundaries. See the [project structure](docs/project-structure.md) for the directory map.

## Technology and approach

| Area | Current choice |
| --- | --- |
| Web | Next.js App Router, React, strict TypeScript, Node.js |
| Data | SQLite, `better-sqlite3`, Drizzle ORM, reviewed SQL migrations |
| UI and map | Tailwind CSS, Mapbox GL JS behind a client adapter |
| AI agent | Mastra, OpenRouter AI SDK provider, GPT-6 Luna by default, structured proposals and fixed-source evals |
| Source processing | Bounded HTTP reads with Got, Cheerio, and Turndown |
| Validation and quality | Zod, ESLint, Prettier, Vitest, Playwright |

The application favors server-rendered content and stable URLs, with client-side interaction for filters and the map. SQLite avoids a separate database server for this first version; write-ahead logging supports short writes alongside public reads. Catalog operations use explicit validation and transactions, while public requests open the existing database read-only. Mapbox is optional for local list-based exploration; public deployment requires token restrictions and usage monitoring.

Behavior is specified in [OpenSpec](openspec/specs/). Active changes describe approved future work, and [decision records](docs/index.md#decisions) explain lasting technology choices. The [ingestion process](docs/ingestion-process.md) explains local catalog research; the current implementation status is recorded in the [build progress](docs/service-build-progress.md).

## Run locally

Use Node.js **26.10.0** and npm **11.19.1** (see `.node-version` and `package.json`). From the repository root:

```sh
npm ci
npm run db:fixtures
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the scope directory or [http://festivals.localhost:3000](http://festivals.localhost:3000) for festival discovery. The fixture command applies migrations and loads fictional records into `./data/eventroam.sqlite`; it is repeatable. Copy `.env.example` to `.env.local` if you need a different database path or want to configure a Mapbox public token and style. Without a token, the list and filters still work.

For optional local catalog research, see `npm run catalog -- --help` and the [development guide](docs/development.md#local-catalog-research). This workflow uses an OpenRouter API key in an ignored `.env` file and previews changes unless `--apply` is passed.

Run `npm run type-check`, `npm run lint`, `npm test`, and `npm run build` for application checks. The [development guide](docs/development.md) covers the full command set and testing workflow; the [documentation index](docs/index.md) links the specifications, decisions, and active changes.
