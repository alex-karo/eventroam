import { readResearchCatalog } from "@/catalog/read/research";
import {
  researchCandidateSchema,
  type ResearchCandidate,
} from "@/ingestion/research/contracts";
import {
  loadEvalSuite,
  type PipelineEvalCase,
} from "@/ingestion/evals/fixtures";
import {
  fixedGeocoding,
  fixedSources,
  seedDatabase,
} from "@/ingestion/evals/run";
import { runCatalogResearch } from "@/ingestion/workflow";
import { loadResearchConfig } from "@/ingestion/runtime/config";
import { generateFixtureEditor, generateFixtureLocation } from "./ingestion";

// Independent model substitutes. Values come from the captured pages, not evaluator rules.
const programmes: Record<string, Record<string, unknown>> = {
  wacken: {
    year: 2027,
    dates: { startsOn: "2027-07-28", endsOn: "2027-07-31", state: "confirmed" },
    countryCode: "DE",
    scheduleStatus: "scheduled",
    locality: "Wacken",
    classification: [
      "validation:festival",
      "validation:music",
      "catalog:term:genre:metal",
      "validation:openair",
    ],
    tickets: {
      basePrice: {
        kind: "exact",
        currency: "EUR",
        minAmount: 366,
        maxAmount: 366,
        coverage: "full_programme",
      },
      variants: [
        {
          label: "Louder ticket",
          amount: 364,
          currency: "EUR",
          url: "https://www.wacken.com/de/tickets-shop/ticket-uebersicht-2027/",
        },
      ],
    },
  },
  roskilde: {
    year: 2027,
    dates: { startsOn: "2027-06-26", endsOn: "2027-07-03", state: "confirmed" },
    countryCode: "DK",
    scheduleStatus: "scheduled",
    locality: "Roskilde",
    venueName: "Festivalpladsen",
    venueAddress: "Darupvej 19",
    sizeEstimate: 130000,
    classification: ["validation:festival", "validation:music"],
    tickets: {
      basePrice: {
        kind: "exact",
        currency: "DKK",
        minAmount: 2650,
        maxAmount: 2650,
        coverage: "full_programme",
      },
      variants: [
        {
          label: "Partoutbillet",
          amount: 2650,
          currency: "DKK",
          url: "https://ticket.roskilde-festival.dk/da/vgkw6td2h3rrfkv/products?c=fz3fh09",
        },
        {
          label: "Todagesbillet",
          amount: 2230,
          currency: "DKK",
          url: "https://ticket.roskilde-festival.dk/da/vgkw6td2h3rrfkv/products?c=7g0tvpp",
        },
        {
          label: "Onsdag",
          amount: 1530,
          currency: "DKK",
          url: "https://ticket.roskilde-festival.dk/da/vgkw6td2h3rrfkv/products?c=2rrklcf",
        },
        {
          label: "Torsdag",
          amount: 1530,
          currency: "DKK",
          url: "https://ticket.roskilde-festival.dk/da/vgkw6td2h3rrfkv/products?c=pjkf5p5",
        },
        {
          label: "Fredag",
          amount: 1530,
          currency: "DKK",
          url: "https://ticket.roskilde-festival.dk/da/vgkw6td2h3rrfkv/products?c=n9tcbkm",
        },
        {
          label: "Lørdag",
          amount: 1530,
          currency: "DKK",
          url: "https://ticket.roskilde-festival.dk/da/vgkw6td2h3rrfkv/products?c=9rdr0dv",
        },
      ],
    },
  },
  sziget: {
    year: 2027,
    dates: { startsOn: "2027-08-10", endsOn: "2027-08-14", state: "confirmed" },
    countryCode: "HU",
    scheduleStatus: "scheduled",
    locality: "Budapest",
    venueName: "Óbuda Island",
    venueAddress: "Május 9. park",
    classification: [
      "validation:festival",
      "validation:music",
      "validation:openair",
    ],
    tickets: {
      basePrice: {
        kind: "exact",
        currency: "EUR",
        minAmount: 372,
        maxAmount: 372,
        coverage: "full_programme",
      },
      variants: [
        {
          label: "Five-day pass",
          amount: 349,
          currency: "EUR",
          url: "https://szi.gt/5daypass_2027",
        },
      ],
    },
  },
};
const links: Record<
  string,
  { website: string; socials: Record<string, string> }
> = {
  wacken: {
    website: "https://www.wacken.com/",
    socials: { youtube: "https://www.youtube.com/wackentv" },
  },
  roskilde: {
    website: "https://www.roskilde-festival.dk/",
    socials: {
      instagram: "https://instagram.com/roskildefestival",
      facebook: "https://www.facebook.com/orangefeeling/",
    },
  },
  sziget: { website: "https://szigetfestival.com/en/", socials: {} },
  glastonbury: {
    website: "https://www.glastonburyfestivals.co.uk/",
    socials: {
      instagram: "https://instagram.com/glastofest",
      tiktok: "https://tiktok.com/@glastonbury",
      facebook: "https://www.facebook.com/glastonburyofficial",
    },
  },
};
const ticketPages: Record<string, string> = {
  wacken: "https://www.wacken.com/de/tickets-shop/ticket-uebersicht-2027/",
  roskilde: "https://www.roskilde-festival.dk/billetter",
  sziget: "https://szigetfestival.com/en/tickets",
};

export function mainCandidate(item: PipelineEvalCase): ResearchCandidate {
  if (item.id === "afro-nation-portugal-blocked") {
    return {
      status: "failed",
      data: null,
      errors: [
        {
          code: "source_blocked",
          url: item.sources[0].attemptedUrl,
          message: "Captured official sources are blocked",
        },
      ],
      unresolved: [
        { message: "Source access is blocked; retry when available" },
      ],
    };
  }
  const programme = programmes[item.id];
  return researchCandidateSchema.parse({
    status: "success",
    errors: [],
    unresolved: [],
    data: {
      eventId: item.initial.event.id,
      eventName: item.initial.event.canonicalName,
      sources: item.sources.map((source) => ({
        url: source.finalUrl,
        information: "Captured source supports the test findings",
      })),
      links: links[item.id],
      previousEdition: null,
      currentOrNextEdition: programme
        ? {
            key: "edition-2027",
            links: { tickets: ticketPages[item.id] },
            ...Object.fromEntries(
              Object.entries(programme).map(([key, value]) => [
                key,
                {
                  value,
                  reason: "Captured official source confirms this fact",
                },
              ]),
            ),
          }
        : null,
    },
  });
}

export async function mainAttempt(id: string) {
  const suite = loadEvalSuite();
  const item = suite.cases.find((item) => item.id === id) as PipelineEvalCase;
  const connection = seedDatabase(suite, item);
  try {
    const before = readResearchCatalog(connection.client);
    const report = await runCatalogResearch(
      { ...item.input, dryRun: false },
      {
        client: connection.client,
        config: loadResearchConfig({
          NODE_ENV: "test",
          OPENROUTER_API_KEY: "fixture",
        }),
        todayUtc: item.todayUtc ?? suite.todayUtc,
        ...fixedSources(item, suite.todayUtc),
        geocodingClient: fixedGeocoding(item),
        generateCandidate: async () => mainCandidate(item),
        generateEditor: generateFixtureEditor,
        generateLocation: generateFixtureLocation,
      },
    );
    return {
      eventId: item.initial.event.id,
      item,
      before,
      after: readResearchCatalog(connection.client),
      report,
    };
  } finally {
    connection.client.close();
  }
}

export function nextEdition(run: Awaited<ReturnType<typeof mainAttempt>>) {
  const savedIds = new Set(
    run.before.flatMap((event) => event.editions.map((edition) => edition.id)),
  );
  return run.after
    .find((event) => event.id === run.eventId)!
    .editions.find((edition) => !savedIds.has(edition.id))!;
}
