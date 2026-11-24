import type { MainCaseDefinition } from "../../main";
import { refreshInput, sourceReplay } from "../fixture";
import { glastonbury } from "./checks";

const eventId = "event:2d90837f6b8f1217f50c";
const website = "https://www.glastonburyfestivals.co.uk/";

export const glastonburyCase = {
  fixture: {
    id: "glastonbury",
    suite: "main",
    origin: "synthetic",
    task: "verify",
    input: refreshInput(eventId),
    initial: {
      event: {
        id: eventId,
        slug: "glastonbury-2027-2d90837f",
        canonicalName: "Glastonbury (2027)",
        links: [
          {
            kind: "other",
            url: website,
            label: "Website (unverified)",
            official: false,
          },
        ],
        editions: [
          {
            id: "edition:2d90837f6b8f1217f50c",
            editionKey: "source-row",
            editionYear: 2027,
            startsOn: "2027-06-23",
            endsOn: "2027-06-27",
            dateState: "confirmed",
            scheduleStatus: "scheduled",
            countryCode: "GB",
            termIds: [],
          },
        ],
      },
    },
    sources: [
      sourceReplay(website, "2026-10-27T15:35:46.163Z", "page.md"),
      sourceReplay(`${website}news/`, "2026-10-27T15:35:46.166Z", "news.md"),
      sourceReplay(`${website}info/`, "2026-10-27T15:35:46.166Z", "info.md"),
      sourceReplay(
        `${website}line-up/`,
        "2026-10-27T15:35:46.778Z",
        "line-up.md",
      ),
      sourceReplay(
        `${website}history/`,
        "2026-10-27T15:35:46.778Z",
        "history.md",
      ),
      sourceReplay(
        `${website}history/history-2025/`,
        "2026-10-30T01:33:37.409Z",
        "history-2025.md",
      ),
      sourceReplay(`${website}areas/`, "2026-10-27T15:35:47.168Z", "areas.md"),
      sourceReplay(
        `${website}worthy-causes/`,
        "2026-10-27T15:35:47.168Z",
        "causes.md",
      ),
      sourceReplay(
        `${website}contact/`,
        "2026-10-27T15:35:47.168Z",
        "contact.md",
      ),
      sourceReplay(
        `${website}news/its-all-been-a-long-story-of-excitement-michael-eavis-turns-90/`,
        "2026-10-27T15:40:11.835Z",
        "birthday.md",
      ),
      sourceReplay(
        `${website}news/pilton-party-2025-in-photos/`,
        "2026-10-27T15:40:11.838Z",
        "pilton-party.md",
      ),
      sourceReplay(
        `${website}info/tickets/`,
        "2026-10-27T15:35:46.777Z",
        "page.md",
        { finalUrl: website },
      ),
      sourceReplay(
        `${website}info/#tickets`,
        "2026-10-27T15:35:46.166Z",
        "info.md",
        { finalUrl: `${website}info/` },
      ),
      sourceReplay(
        "https://instagram.com/glastofest",
        "2026-10-27T00:00:00.000Z",
        "instagram.md",
        {
          method: "social_stub",
          status: "unsupported",
          reasonCode: "social_content_unsupported",
        },
      ),
    ],
    todayUtc: "2026-10-27",
    provenance: {
      kind: "synthetic",
      note: "Owner-requested synthetic replay of an unannounced next festival. The task and source facts remain the same as the 2026-10-27 scenario. On 2026-10-30, the ten adapted page bodies were rebuilt as synthetic HTML from the saved scenario Markdown, then passed through the production readPage extractor with @mdream/js@2.0.3 and standard frontmatterPlugin(). The old generated page heading became the synthetic head title; region labels became matching HTML landmarks. No extra head claims were invented. These reconstructed HTML documents are synthetic inputs, not original website captures. All existing link destinations and numeric values were checked against the old scenario. Main-festival announcement, sale, prize-draw and dated programme claims remain removed; news dates, separate local events, archive navigation, contact links and normal page controls remain. Info still says that next-festival details are not announced. The evaluation date and adapted-page retrieval times remain those of the original scenario. History 2025 is a separate, unedited official HTML capture from 2026-10-30 processed by the same production reader. It gives GBP 378.50 and capacity 210,000 without programme dates or participant attendance. Its observed retrieval time is retained. The original tickets-path redirect and Info Tickets anchor remain mapped. Instagram remains the production social stub. Synthetic HTML, raw History 2025 HTML and reader outputs are saved locally under data/main-fixtures-mdream-20261030/glastonbury/. No live source fallback is used during evals. Preserve the saved 2027 Edition and draft Event.",
    },
  },
  moduleUrl: import.meta.url,
  evaluate: glastonbury,
  // areas.md lists music stages, theatre, and circus.
  descriptionReference:
    "A festival whose main programme combines live music and performing arts such as theatre and circus. Stages and festival areas are examples of how the programme is presented.",
} satisfies MainCaseDefinition;
