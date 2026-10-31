import { expect, test } from "vitest";
import { normalizeWireCandidate } from "@/test/ingestion-fixtures/research-wire";
import { researchCandidateSchema } from "../contracts";

const raw = () => ({
  status: "success",
  errors: [],
  unresolved: [],
  data: {
    eventId: null,
    eventName: "Example Fest",
    reason: null,
    sources: [],
    summary: null,
    links: { website: null, socials: { x: null } },
    previousEdition: null,
    currentOrNextEdition: {
      key: "2027",
      year: null,
      dates: {
        value: null,
        reason: "Official cancellation removes announced dates",
      },
      venueName: { value: null, reason: "Old venue explicitly withdrawn" },
      tickets: {
        value: { variants: [], basePrice: null },
        reason: "Official page withdrew sales",
      },
      links: { tickets: null },
    },
  },
});

test("wire normalization omits only declared optional null slots and preserves intentional clearing", () => {
  const value = normalizeWireCandidate(raw());
  expect(value).toMatchObject({
    data: {
      previousEdition: null,
      currentOrNextEdition: {
        dates: { value: null },
        venueName: { value: null },
        tickets: { value: { basePrice: null } },
      },
    },
  });
  expect(researchCandidateSchema.safeParse(value).success).toBe(true);
  expect(
    researchCandidateSchema.safeParse(
      normalizeWireCandidate({
        status: "failed",
        data: null,
        errors: [{ code: "limit_reached", message: "Exhausted" }],
        unresolved: [],
      }),
    ).success,
  ).toBe(true);
});

test("required nulls and unknown legacy fields survive normalization for strict rejection", () => {
  for (const mutation of [
    (item: ReturnType<typeof raw>) => {
      Object.assign(item.data, { claims: null });
    },
    (item: ReturnType<typeof raw>) => {
      Object.assign(item.data.currentOrNextEdition!, { timeZone: null });
    },
    (item: ReturnType<typeof raw>) => {
      Object.assign(item.data.currentOrNextEdition!.dates, {
        value: { startsOn: "2027-06-01", endsOn: null, state: "confirmed" },
      });
    },
    (item: ReturnType<typeof raw>) => {
      Object.assign(item.data.currentOrNextEdition!.tickets, { value: null });
    },
    (item: ReturnType<typeof raw>) => {
      Object.assign(item.data, { sources: null });
    },
  ]) {
    const item = raw();
    mutation(item);
    expect(
      researchCandidateSchema.safeParse(normalizeWireCandidate(item)).success,
    ).toBe(false);
  }
});

test("size wire values preserve reasoned numbers and clearing, omit absence and reject capacity", () => {
  for (const sizeEstimate of [
    null,
    { value: 8000, reason: "Approximate participants" },
    { value: null, reason: "Estimate withdrawn" },
  ]) {
    const item = raw();
    Object.assign(item.data.currentOrNextEdition!, { sizeEstimate });
    const parsed = researchCandidateSchema.parse(normalizeWireCandidate(item));
    expect(parsed.data!.currentOrNextEdition!.sizeEstimate).toEqual(
      sizeEstimate ?? undefined,
    );
  }
  for (const fields of [
    { capacityEstimate: null },
    { capacityEstimate: { value: 8000, reason: "Old contract" } },
    { sizeEstimate: { value: 0, reason: "Invalid" } },
    { sizeEstimate: { value: 8000, reason: "" } },
  ]) {
    const item = raw();
    Object.assign(item.data.currentOrNextEdition!, fields);
    expect(
      researchCandidateSchema.safeParse(normalizeWireCandidate(item)).success,
    ).toBe(false);
  }
});

test("research requires both nullable slots and rejects the old array shape", () => {
  for (const slot of ["previousEdition", "currentOrNextEdition"]) {
    const item = raw();
    const missing = { ...item, data: { ...item.data, [slot]: undefined } };
    expect(
      researchCandidateSchema.safeParse(normalizeWireCandidate(missing))
        .success,
    ).toBe(false);
  }
  const item = raw();
  expect(
    researchCandidateSchema.safeParse(
      normalizeWireCandidate({
        ...item,
        data: { ...item.data, currentOrNextEdition: null },
      }),
    ).success,
  ).toBe(true);
  const { previousEdition, currentOrNextEdition, ...data } = item.data;
  expect(previousEdition).toBeNull();
  expect(
    researchCandidateSchema.safeParse(
      normalizeWireCandidate({
        ...item,
        data: { ...data, editions: [currentOrNextEdition] },
      }),
    ).success,
  ).toBe(false);
});
