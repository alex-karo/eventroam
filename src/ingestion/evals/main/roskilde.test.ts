import { beforeAll, expect, test } from "vitest";
import { evaluateMainCase } from "../main";
import { mainAttempt, nextEdition as next } from "@/test/eval-main";

type Attempt = Awaited<ReturnType<typeof mainAttempt>>;
let fixture: Attempt;
const evaluateRoskilde = (run: Attempt) =>
  evaluateMainCase(run.item, run.before, run.after, run.report);
beforeAll(async () => {
  fixture = await mainAttempt("roskilde");
});

test.each<[string, (run: Attempt) => void, boolean]>([
  [
    "full Smart Ticket price",
    (r) => {
      next(r).priceDetails!.push({
        label: "Smart Ticket",
        amount: 2720,
        currency: "DKK",
        url: "https://ticket.roskilde-festival.dk/da/3e9u8rgkhdlw9dg/products",
      });
    },
    true,
  ],
  [
    "displayed Smart Ticket monthly payment",
    (r) => {
      next(r).priceDetails![0] = {
        label: "Smart Ticket",
        amount: 524,
        currency: "DKK",
        terms: "Five monthly instalments; plus a DKK 100 fee.",
        url: "https://ticket.roskilde-festival.dk/da/3e9u8rgkhdlw9dg/products",
      };
    },
    true,
  ],
  [
    "separate Pumpehuset event as festival admission",
    (r) => {
      next(r).priceDetails![0] = {
        label: "Headline Flip",
        amount: 210,
        currency: "DKK",
        url: "https://ticket.roskilde-festival.dk/da/ekxtjekynuuae5p/products",
      };
    },
    false,
  ],
  [
    "venue alternative and full festival address",
    (r) => {
      next(r).venueName = "Roskilde Festivalplads";
      next(r).venueAddress =
        "Festivalpladsen, Darupvej 19, 4000 Roskilde, Denmark";
    },
    true,
  ],
  [
    "wrong product and price combination",
    (r) => {
      next(r).priceDetails![0].amount = 2650;
      next(r).priceDetails![0].url =
        "https://ticket.roskilde-festival.dk/da/vgkw6td2h3rrfkv/products?c=7g0tvpp";
    },
    false,
  ],
  [
    "gift card as admission",
    (r) => {
      next(r).priceDetails!.push({
        label: "Gavekort",
        amount: 250,
        currency: "DKK",
        url: "https://ticket.roskilde-festival.dk/da/vgkw6td2h3rrfkv/products?c=7wxh8y3",
      });
    },
    false,
  ],
  [
    "shortened offer list with free labels",
    (r) => {
      next(r).priceDetails = [
        {
          ...next(r).priceDetails!.find((offer) => offer.amount === 2650)!,
          label: "Eight days of festival access",
        },
      ];
    },
    true,
  ],
  [
    "duplicate offer",
    (r) => {
      next(r).priceDetails!.push(next(r).priceDetails![0]);
    },
    true,
  ],
])("main evaluator: %s", (_, change, expectedPass) => {
  const run = structuredClone(fixture);
  change(run);
  expect(evaluateRoskilde(run).passed).toBe(expectedPass);
});

test("wrong offers, extra terms and changed saved data count as errors without completeness units", () => {
  const run = structuredClone(fixture);
  next(run).priceDetails![0].currency = "EUR";
  next(run).terms.push({
    id: "validation:unsupported-genre",
    facet: "genre",
    slug: "unsupported",
    name: "Unsupported",
    parentId: null,
  });
  run.after[0].editions.find(
    (e) => e.id === run.before[0].editions[0].id,
  )!.startsOn = "2026-01-01";
  const score = evaluateRoskilde(run);
  expect(score).toMatchObject({
    errorCount: 3,
    noCheckedErrors: 0,
    passed: false,
    required: { correct: 5, expected: 5 },
    additional: { correct: 11, expected: 11 },
  });
  expect(
    score.checks
      .filter((item) => item.status === "wrong")
      .map((item) => item.path),
  ).toEqual(["saved.editions", "next.classification", "next.offers.0"]);
});
