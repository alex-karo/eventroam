import type { MainCaseDefinition } from "../../main";
import { refreshInput, sourceReplay } from "../fixture";
import { candidate, forward, reverse } from "../geocoding";
import { rise } from "./checks";

const eventId = "event:a6a248bdc3ed1204cc7c";
const website = "https://www.rise-festival.com/";

const lesDeuxAlpesLocality = candidate({
  latitude: 45.0099949,
  longitude: 6.1237609,
  placeId:
    "511718682dbb7e1840593b504c8347814640f00101f9010556680000000000c0020892030e4c6573204465757820416c706573",
  label: "Les Deux Alpes, ARA, France",
  name: "Les Deux Alpes",
  countryCode: "FR",
  locality: "Les Deux Alpes",
  address: "Les Deux Alpes",
  objectType: "locality",
  originalType: "city",
  category: "administrative",
  confidence: 1,
});

export const riseCase = {
  fixture: {
    id: "rise",
    suite: "main",
    origin: "captured",
    task: "fill",
    todayUtc: "2026-11-07",
    provenance: {
      kind: "captured-adapted",
      note: "The 2026-11-07 preview for run 9be40a73-a241-4dcb-b96f-0b6eadbacbb3 captured the official pages, a search result for the 2025 page, and normalized Geoapify responses. The Markdown files retain the canonical source bodies without the application headers. Failed reads use empty Markdown. The seed uses the saved 2025 and 2026 Editions, their saved dates and points, and suite terms. It omits saved ticket data and shared social links so the case can check their handling from these captures. A 2026-11-09 HTTP capture adds the dated Santa Ski page from the official 2025 gallery. The production HTML converter supplies its Markdown. Fixed historical searches return this photo page first.",
    },
    input: refreshInput(eventId, "full"),
    initial: {
      event: {
        id: eventId,
        slug: "rise-festival-a6a248bd",
        canonicalName: "Rise Festival",
        description:
          "A week-long snow, music and festivities event in Les 2 Alpes, France.",
        homeScope: "festivals",
        publicationState: "published",
        links: [{ kind: "official_site", url: website, official: true }],
        editions: [
          {
            id: "2a0497fb-de63-4e3b-ac10-8d6beb843a27",
            editionKey: "2025",
            editionYear: 2025,
            displayName: "Rise 2025",
            startsOn: "2025-12-06",
            endsOn: "2025-12-13",
            dateState: "confirmed",
            scheduleStatus: "announced",
            publicationState: "draft",
            countryCode: "FR",
            locality: "Les 2 Alpes",
          },
          {
            id: "edition:a6a248bdc3ed1204cc7c",
            editionKey: "2026",
            editionYear: 2026,
            startsOn: "2026-12-05",
            endsOn: "2026-12-12",
            dateState: "confirmed",
            scheduleStatus: "scheduled",
            publicationState: "published",
            countryCode: "FR",
            latitude: 45.0122,
            longitude: 6.1233,
            coordinatePrecision: "approximate",
            termIds: [
              "validation:festival",
              "validation:music",
              "validation:topic:snow-sports",
              "catalog:term:genre:electronic",
            ],
          },
        ],
      },
    },
    sources: [
      sourceReplay(website, "2026-11-07T03:27:53.831Z", "page.md"),
      sourceReplay(
        `${website}book-rise-festival-2026`,
        "2026-11-07T03:28:09.200Z",
        "booking.md",
        { method: "firecrawl" },
      ),
      sourceReplay(
        `${website}travel`,
        "2026-11-07T03:28:09.201Z",
        "travel.md",
        { method: "firecrawl" },
      ),
      sourceReplay(
        `${website}location`,
        "2026-11-07T03:28:09.201Z",
        "location.md",
        { method: "firecrawl" },
      ),
      sourceReplay(
        `${website}line-up`,
        "2026-11-07T03:28:28.073Z",
        "lineup.md",
        { method: "firecrawl" },
      ),
      sourceReplay(
        `${website}stages-parties`,
        "2026-11-07T03:28:33.406Z",
        "stages.md",
        { method: "firecrawl" },
      ),
      sourceReplay(
        `${website}faqs-2026`,
        "2026-11-07T03:28:50.830Z",
        "faq.md",
        { method: "firecrawl" },
      ),
      sourceReplay(
        `${website}gallery`,
        "2026-11-07T03:29:06.349Z",
        "unavailable.md",
        { status: "failed", reasonCode: "oversized_response" },
      ),
      sourceReplay(
        `${website}book-rise-2026-tickets`,
        "2026-11-07T03:29:34.812Z",
        "tickets.md",
        { method: "firecrawl" },
      ),
      sourceReplay(
        `${website}book-package-2026`,
        "2026-11-07T03:29:34.813Z",
        "packages.md",
        { method: "firecrawl" },
      ),
      sourceReplay(
        `${website}contact-us`,
        "2026-11-07T03:29:34.813Z",
        "contact.md",
        { method: "firecrawl" },
      ),
      sourceReplay(
        `${website}homepage`,
        "2026-11-07T03:29:59.396Z",
        "unavailable.md",
        { status: "failed", reasonCode: "oversized_response" },
      ),
      sourceReplay(
        `${website}welcome-to-rise-2025`,
        "2026-11-07T03:30:43.858Z",
        "history-2025.md",
        { method: "firecrawl" },
      ),
      sourceReplay(
        "https://www.gallery.rise-festival.com/2025/highlights/",
        "2026-11-07T03:31:16.915Z",
        "unavailable.md",
        { status: "failed", reasonCode: "http_503" },
      ),
      sourceReplay(
        "https://www.gallery.rise-festival.com/2025/gallery/",
        "2026-11-07T03:31:16.914Z",
        "unavailable.md",
        { status: "failed", reasonCode: "http_503" },
      ),
      sourceReplay(
        "https://www.gallery.rise-festival.com/2025/gallery/0a455b21-153d-4006-9803-69283683a56e?image_keywords=snow%3ASanta+Ski",
        "2026-11-09T02:34:31Z",
        "gallery-2025-ski.md",
      ),
    ],
    geocoding: [
      reverse(
        {
          latitude: 45.0122,
          longitude: 6.1233,
        },
        candidate({
          latitude: 45.012199,
          longitude: 6.124103,
          placeId:
            "518a5759db147f1840599f05a1bc8f814640c00203e203476f70656e6164647265737365733a616464726573733a66722f636f756e747279776964652d6164647265737365732d636f756e7472793a35343231326236363963623365353739",
          label: "63 Avenue De La Muzelle, 38860 Vénosc, France",
          countryCode: "FR",
          locality: "Vénosc",
          address: "63 Avenue De La Muzelle",
          objectType: "venue",
          originalType: "building",
        }),
        0.06312396981717701,
      ),
      forward("Les 2 Alpes, France", "FR", [
        candidate({
          latitude: 45.01571,
          longitude: 6.12679,
          placeId:
            "51e0d6dd3cd5811840592e1c08c902824640c0020192031b5265736964656e6365204d61657661204c6573203220416c706573e2031667656f6e616d65733a76656e75653a39313738383830",
          label:
            "Residence Maeva Les 2 Alpes, Mont-de-Lans, Vénosc, Isère, France",
          name: "Residence Maeva Les 2 Alpes",
          countryCode: "FR",
          locality: "Vénosc",
          address: "Residence Maeva Les 2 Alpes",
          objectType: "venue",
          originalType: "amenity",
          confidence: 0.81,
        }),
        candidate({
          latitude: 45.0097485,
          longitude: 6.1228844,
          placeId:
            "511cc17c68d57d184059b05758703f814640f00103f9012331a84203000000c00201920315537069726974206f66204c6573203220416c706573e203246f70656e7374726565746d61703a76656e75653a6e6f64652f3134303033323230373731",
          label:
            "Spirit of Les 2 Alpes, Avenue de la Muzelle, 38860 Mont-de-Lans, France",
          name: "Spirit of Les 2 Alpes",
          countryCode: "FR",
          locality: "Les Deux Alpes",
          address: "Spirit of Les 2 Alpes",
          objectType: "venue",
          originalType: "amenity",
          category: "commercial.gift_and_souvenir",
          confidence: 0.81,
        }),
        candidate({
          latitude: 44.9988811,
          longitude: 6.1270741,
          placeId:
            "51aeac7eb61f82184059d78bfc55db7f4640f00102f901f551062e00000000c0020192030b4c6573203220616c706573e203216f70656e7374726565746d61703a76656e75653a7761792f373732313636313333",
          label: "Les 2 alpes, Venosc, 38860 Les Deux Alpes, France",
          name: "Les 2 alpes",
          countryCode: "FR",
          locality: "Les Deux Alpes",
          address: "Les 2 alpes",
          objectType: "venue",
          originalType: "amenity",
          category: "sport.pitch",
          confidence: 0,
        }),
      ]),
      forward("Les Deux Alpes, Isère, France", "FR", [lesDeuxAlpesLocality]),
      forward(
        "Les Deux Alpes, France",
        "FR",
        [lesDeuxAlpesLocality],
        "Geoapify forward response captured on 2026-11-09. The production client supplies the normalized candidates.",
      ),
    ],
    discoveries: [
      {
        queryPattern: "^(?=.*\\brise\\b)(?=.*\\b2025\\b)",
        candidates: [
          {
            url: "https://www.gallery.rise-festival.com/2025/gallery/0a455b21-153d-4006-9803-69283683a56e?image_keywords=snow%3ASanta+Ski",
            title: "Rise Festival | Gallery | Santa Ski",
            highlights: ["11 December 25\n\nSanta Ski"],
          },
          {
            url: "https://www.rise-festival.com/welcome-to-rise-2025",
            title: "Welcome to Rise 2025 | Rise Festival",
            highlights: [
              "Welcome to Rise 2025 | Rise Festival \n\n# Welcome to Rise 2025\n\n6TH - 13TH DECEMBER 2025\n\nAn action-packed week of snow, music, and festivities held in the incredible snow-covered village of Les 2 Alpes France.\n\n## Rise 2025 Final Tickets! \n\nA small handful of tickets remain for 2025. \n\nYou can still purchase after party tickets, add lessons, equipment hire and dining experiences to your booking.\n\nA LIMITED AMOUNT REMAIN!\n\nTICKETS & EXTRAS\n\nEverything extra you need to amp up your week. Lessons, equipment hire and everything in between.\n\nFestival Ticket & 6 Day Lift Pass\n\nAfter Parties\n\nLocal Day Tickets\n\nVIP UPGRADES\n\nIf you're looking to elevate your experience, we have just the thing. For the first time ever, we're offering a select number of VIP upgrades that we believe will take your week from great to unforgettable. \n\nHeated viewing platforms\n\nQueue jump at all main stages\n\nAccess to every afterparty at the Rise Arena\n\n### Manage your booking\n\nThe Rise booking portal is where you will get a complete overview of your week on the mountain. It’s where you download your tickets, check in for your stay and see who is in your crew. \n\n- View and download your tickets \n- Check in for all bookings\n- Manage your equipment hire and selection\n\n## CASHLESS TOP UP\n\n...\n\nGeneral Enquiries hello@rise-festival.com",
            ],
          },
        ],
      },
    ],
  },
  moduleUrl: import.meta.url,
  evaluate: rise,
  // stages.md and location.md describe electronic music at a ski resort.
  descriptionReference:
    "A winter festival that combines electronic music and snow sports at a ski resort, with outdoor stages and indoor venues.",
} satisfies MainCaseDefinition;
