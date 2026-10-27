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
    additional: { correct: 7, expected: 8 },
    errorCount: 0,
    passed: false,
  });
  next.countryCode = "US";
  expect(
    evaluateMainCase(run.item, run.before, run.after, run.report).errorCount,
  ).toBe(1);
});

test.each(["wacken", "sziget"])(
  "%s accepts displayed and total base prices, but rejects other prices",
  (id) => {
    const run = attempt(id);
    const next = nextEdition(run);
    const offer = next.priceDetails![0];
    next.links.find((link) => link.kind === "ticketing")!.url =
      id === "wacken"
        ? "https://ticketstore.wacken.com/de/wacken-open-air-2027/4-day-tickets"
        : offer.url!;
    expect(
      evaluateMainCase(run.item, run.before, run.after, run.report).passed,
    ).toBe(true);
    next.priceMinMinor = next.priceMaxMinor = id === "wacken" ? 36400 : 34900;
    expect(
      evaluateMainCase(run.item, run.before, run.after, run.report).passed,
    ).toBe(true);
    next.priceMinMinor = next.priceMaxMinor = 100;
    offer.currency = "USD";
    expect(
      evaluateMainCase(run.item, run.before, run.after, run.report),
    ).toMatchObject({ errorCount: 2, passed: false });
  },
);

test.each([
  [
    "wacken",
    {
      displayName: "W:O:A 2026",
      locality: "Wacken",
      administrativeArea: "Schleswig-Holstein",
      latitude: 54.02078040137254,
      longitude: 9.375972747802734,
      coordinatePrecision: "locality",
    },
  ],
  [
    "sziget",
    {
      displayName: "Sziget Festival 2026",
      venueName: "Óbuda Island",
      venueAddress: "Május 9. park, Budapest, Hungary, 1033",
      locality: "Budapest",
      latitude: 47.49835,
      longitude: 19.04045,
      coordinatePrecision: "locality",
    },
  ],
])(
  "%s permits listed historical additions and protects other saved facts",
  (id, updates) => {
    const run = attempt(id);
    const saved = run.after[0].editions.find(
      (edition) => edition.id === run.before[0].editions[0].id,
    )!;
    Object.assign(saved, updates, {
      version: 2,
      updatedAt: "2026-10-27T11:00:00.000Z",
    });
    expect(
      evaluateMainCase(run.item, run.before, run.after, run.report).passed,
    ).toBe(true);
    saved.locality = "Wrong city";
    expect(
      evaluateMainCase(run.item, run.before, run.after, run.report).errorCount,
    ).toBe(1);
    Object.assign(saved, updates);
    saved.startsOn = "2026-01-01";
    expect(
      evaluateMainCase(run.item, run.before, run.after, run.report).errorCount,
    ).toBe(1);
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

test.each(["wacken", "sziget"])("%s has no format completeness unit", (id) => {
  const run = attempt(id);
  nextEdition(run).terms = nextEdition(run).terms.filter(
    (term) => term.facet !== "format",
  );
  const score = evaluateMainCase(run.item, run.before, run.after, run.report);
  expect(score.additional).toMatchObject({ correct: 8, expected: 8 });
  expect(score.passed).toBe(true);
});

test.each(["sziget", "roskilde"])(
  "%s accepts source-backed music genres",
  (id) => {
    const run = attempt(id);
    nextEdition(run).terms.push({
      id: "catalog:term:genre:electronic",
      facet: "genre",
      slug: "electronic",
      name: "Electronic",
      parentId: null,
    });
    if (id === "roskilde") {
      nextEdition(run).terms.push({
        id: "catalog:term:genre:metal",
        facet: "genre",
        slug: "metal",
        name: "Metal",
        parentId: null,
      });
    }
    expect(
      evaluateMainCase(run.item, run.before, run.after, run.report).passed,
    ).toBe(true);
  },
);

test.each(["wacken", "sziget", "roskilde"])(
  "%s permits supported historical classification and publication, but rejects other terms",
  (id) => {
    const run = attempt(id);
    const saved = run.after[0].editions.find(
      (e) => e.id === run.before[0].editions[0].id,
    )!;
    saved.terms = loadEvalSuite()
      .terms.filter((term) =>
        ["validation:festival", "validation:music"].includes(term.id),
      )
      .map((term) => ({ ...term, parentId: null }));
    saved.publicationState = "published";
    expect(
      evaluateMainCase(run.item, run.before, run.after, run.report).passed,
    ).toBe(true);
    saved.terms.push({
      id: "validation:unsupported",
      facet: "genre",
      slug: "unsupported",
      name: "Unsupported",
      parentId: null,
    });
    expect(
      evaluateMainCase(run.item, run.before, run.after, run.report).errorCount,
    ).toBe(1);
  },
);

test("Sziget rejects exact precision for a city point and protects a saved point", () => {
  const run = attempt("sziget");
  const saved = run.after[0].editions.find(
    (e) => e.id === run.before[0].editions[0].id,
  )!;
  Object.assign(saved, {
    latitude: 47.49835,
    longitude: 19.04045,
    coordinatePrecision: "exact",
  });
  expect(
    evaluateMainCase(run.item, run.before, run.after, run.report).errorCount,
  ).toBe(1);
  saved.coordinatePrecision = "locality";
  Object.assign(run.before[0].editions[0], {
    latitude: 47.55,
    longitude: 19.05,
    coordinatePrecision: "exact",
  });
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

test("empty optional saved fields without expectations can be filled without credit", () => {
  const run = attempt("sziget");
  const saved = run.after[0].editions.find(
    (edition) => edition.id === run.before[0].editions[0].id,
  )!;
  const baseline = evaluateMainCase(
    run.item,
    run.before,
    run.after,
    run.report,
  );
  saved.administrativeArea = "Budapest";
  saved.timeZone = "Europe/Budapest";
  saved.priceDetails = structuredClone(nextEdition(run).priceDetails);
  saved.links = structuredClone(nextEdition(run).links);
  expect(evaluateMainCase(run.item, run.before, run.after, run.report)).toEqual(
    baseline,
  );

  const original = run.before[0].editions[0];
  original.administrativeArea = "Saved region";
  for (const replacement of ["Budapest", null]) {
    saved.administrativeArea = replacement;
    expect(
      evaluateMainCase(run.item, run.before, run.after, run.report),
    ).toMatchObject({ errorCount: 1, passed: false });
  }
});

test("saved optional collections and empty required fields remain protected", () => {
  const run = attempt("glastonbury");
  const original = run.before[0].editions[0];
  const saved = run.after[0].editions[0];
  original.links = structuredClone(run.after[0].links);
  saved.links = [];
  expect(
    evaluateMainCase(run.item, run.before, run.after, run.report),
  ).toMatchObject({ errorCount: 1, passed: false });
  original.links = [];
  original.countryCode = null;
  expect(
    evaluateMainCase(run.item, run.before, run.after, run.report),
  ).toMatchObject({ errorCount: 1, passed: false });
});

test("main fixture misses stay diagnostic without masking missing or wrong facts", () => {
  const run = attempt("wacken");
  run.report.sources.push({
    ...run.report.sources[0],
    reason: "not_in_eval_fixture",
    outcome: "blocked",
  });
  for (const origin of ["initial", "agent"] as const) {
    run.report.geocoding.observations.push({
      origin,
      request: { direction: "forward", query: "missing", countryCode: "DE" },
      slots: [],
      cacheHit: false,
      result: { status: "error", code: "fixture_miss" },
      pointIds: [],
    });
  }
  const report = structuredClone(run.report);
  expect(
    evaluateMainCase(run.item, run.before, run.after, run.report).passed,
  ).toBe(true);
  expect(run.report).toEqual(report);
  nextEdition(run).countryCode = null;
  expect(
    evaluateMainCase(run.item, run.before, run.after, run.report),
  ).toMatchObject({ required: { correct: 4 }, errorCount: 0, passed: false });
  nextEdition(run).countryCode = "US";
  expect(
    evaluateMainCase(run.item, run.before, run.after, run.report),
  ).toMatchObject({ errorCount: 1, passed: false });
});

test.each(["wacken", "glastonbury"])(
  "%s accepts announced or scheduled, but not cancelled or postponed",
  (id) => {
    const run = attempt(id);
    const edition =
      id === "wacken" ? nextEdition(run) : run.after[0].editions[0];
    edition.scheduleStatus = "announced";
    expect(
      evaluateMainCase(run.item, run.before, run.after, run.report).passed,
    ).toBe(true);
    for (const status of ["cancelled", "postponed"] as const) {
      edition.scheduleStatus = status;
      expect(
        evaluateMainCase(run.item, run.before, run.after, run.report).passed,
      ).toBe(false);
    }
  },
);

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
