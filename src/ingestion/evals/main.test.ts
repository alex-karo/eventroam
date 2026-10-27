import { beforeAll, expect, test } from "vitest";
import { mainAttempt, nextEdition } from "@/test/eval-main";
import { loadEvalSuite } from "./fixtures";
import { assertMainCase, evaluateMainCase } from "./main";
import { readResearchCatalog } from "@/catalog/read/research";
import { seedDatabase } from "./run";

const fillIds = ["wacken", "roskilde", "sziget"];
const mainIds = [...fillIds, "glastonbury", "afro-nation-portugal-blocked"];
const attempts = new Map<string, Awaited<ReturnType<typeof mainAttempt>>>();
beforeAll(async () => {
  for (const id of mainIds) {
    attempts.set(id, await mainAttempt(id));
  }
});
const attempt = (id: string) => structuredClone(attempts.get(id)!);
test.each(mainIds)(
  "%s uses isolated apply and explicit source-backed checks",
  (id) => {
    const run = attempt(id);
    const score = evaluateMainCase(run.item, run.before, run.after, run.report);
    expect(
      score.conditions.filter((item) => !item.passed),
      JSON.stringify(run.report.errors),
    ).toEqual([]);
    expect(score.checks.filter((item) => item.status !== "correct")).toEqual(
      [],
    );
    expect(score.passed).toBe(true);
  },
);

test("required and optional omissions lower completeness; a wrong supplied value adds an error", () => {
  const run = attempt("wacken");
  const next = nextEdition(run);
  next.countryCode = null;
  next.locality = null;
  const omitted = evaluateMainCase(run.item, run.before, run.after, run.report);
  expect(omitted).toMatchObject({
    required: { correct: 4, expected: 5 },
    additional: { correct: 8, expected: 9 },
    errorCount: 0,
    passed: false,
  });
  next.countryCode = "US";
  expect(
    evaluateMainCase(run.item, run.before, run.after, run.report).errorCount,
  ).toBe(1);
});

test.each(["wacken", "sziget"])(
  "%s requires the mandatory fee in base price and accepts captured ticket URLs",
  (id) => {
    const run = attempt(id);
    const next = nextEdition(run);
    const offer = next.priceDetails![0];
    next.links.find((link) => link.kind === "ticketing")!.url =
      id === "wacken"
        ? "https://ticketstore.wacken.com/de/wacken-open-air-2027/4-day-tickets?utm_source=website_wacken&utm_medium=referral&utm_campaign=woa_2027_ticket_button_20260802"
        : offer.url!;
    expect(
      evaluateMainCase(run.item, run.before, run.after, run.report).passed,
    ).toBe(true);
    next.priceMinMinor = next.priceMaxMinor = id === "wacken" ? 36400 : 34900;
    offer.currency = "USD";
    expect(
      evaluateMainCase(run.item, run.before, run.after, run.report),
    ).toMatchObject({ errorCount: 2, passed: false });
  },
);

test("Sziget checks each product against its own price; fee totals also pass", () => {
  const run = attempt("sziget");
  const next = nextEdition(run);
  next.priceDetails = [
    {
      label: "Youth admission",
      amount: 297,
      currency: "EUR",
      url: "https://szi.gt/21andUnderPass_2027",
    },
    {
      label: "Premium pass",
      amount: 606,
      currency: "EUR",
      url: "https://szi.gt/VIP_5day_2027",
    },
  ];
  expect(
    evaluateMainCase(run.item, run.before, run.after, run.report).passed,
  ).toBe(true);
  next.priceDetails[0].amount = 606;
  expect(
    evaluateMainCase(run.item, run.before, run.after, run.report).errorCount,
  ).toBe(1);
});

test("Glastonbury protects its saved Edition", () => {
  const run = attempt("glastonbury");
  run.after[0].editions[0].startsOn = "2027-01-01";
  expect(
    evaluateMainCase(run.item, run.before, run.after, run.report).checks,
  ).toContainEqual(
    expect.objectContaining({ path: "saved.editions", status: "wrong" }),
  );
});

test("Afro Nation protects the full saved Event when sources are blocked", () => {
  const run = attempt("afro-nation-portugal-blocked");
  run.after[0].canonicalName = "Unsupported name";
  expect(
    evaluateMainCase(run.item, run.before, run.after, run.report).checks,
  ).toContainEqual(
    expect.objectContaining({ path: "saved.event", status: "wrong" }),
  );
});

test.each<[string, (run: ReturnType<typeof attempt>) => void]>([
  [
    "next.identity",
    (run) => {
      run.after[0].editions.push({ ...nextEdition(run), id: "duplicate" });
    },
  ],
  [
    "next.identity",
    (run) => {
      const operation = run.report.operations.find(
        (operation) => operation.kind === "createEdition",
      )!;
      run.report.references[operation.tempKey!] = run.before[0].editions[0].id;
    },
  ],
  [
    "publication",
    (run) => {
      nextEdition(run).publicationState = "draft";
    },
  ],
  [
    "protected.events",
    (run) => {
      const other = { ...structuredClone(run.before[0]), id: "unrelated" };
      run.before.push(other);
      run.after.push({
        ...structuredClone(other),
        canonicalName: "Wrong name",
      });
    },
  ],
  [
    "fixtures",
    (run) => {
      run.report.sources.push({
        ...run.report.sources[0],
        reason: "not_in_eval_fixture",
        outcome: "blocked",
      });
    },
  ],
  [
    "fixtures",
    (run) => {
      run.report.geocoding.observations.push({
        origin: "initial",
        request: { direction: "forward", query: "missing", countryCode: "DE" },
        slots: [],
        cacheHit: false,
        result: { status: "error", code: "fixture_miss" },
        pointIds: [],
      });
    },
  ],
])("shared main condition %s rejects invalid output (%#)", (path, change) => {
  const run = attempt("wacken");
  change(run);
  const score = evaluateMainCase(run.item, run.before, run.after, run.report);
  expect(score.passed).toBe(false);
  expect(score.conditions).toContainEqual(
    expect.objectContaining({ path, passed: false }),
  );
});

test("a new attempt starts from the seed after a completed apply", () => {
  const run = attempt("roskilde");
  expect(run.after).not.toEqual(run.before);
  const connection = seedDatabase(loadEvalSuite(), run.item);
  try {
    expect(readResearchCatalog(connection.client)).toEqual(run.before);
  } finally {
    connection.client.close();
  }
});

test("a main fixture needs a registered evaluator", () => {
  const item = loadEvalSuite().cases.find((item) => item.id === "roskilde")!;
  if (item.suite !== "main") {
    throw new Error("Test needs the main case");
  }
  expect(() => assertMainCase({ ...item, id: "unregistered" })).toThrow(
    "registered pipeline evaluator",
  );
});
