import type { Role } from "./invoke";

type RecordValue = Record<string, unknown>;
function record(value: unknown): value is RecordValue {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function omitNull(value: unknown, keys: readonly string[]) {
  if (!record(value)) {
    return;
  }
  for (const key of keys) {
    if (value[key] === null) {
      delete value[key];
    }
  }
}
const normalizers: Partial<Record<Role, (value: RecordValue) => void>> = {
  general: normalizeGeneral,
  tickets: normalizeTickets,
  classification: normalizeClassification,
  links: normalizeLinks,
};

/** Restore optional fields in the known role transport contracts. */
export function normalizeRoleWire(role: Role, raw: unknown): unknown {
  const normalize = normalizers[role];
  if (!normalize || !record(raw)) {
    return raw;
  }
  const value = structuredClone(raw);
  if (Array.isArray(value.unresolved)) {
    for (const question of value.unresolved) {
      omitNull(question, ["editionKey", "field"]);
    }
  }
  normalize(value);
  return value;
}

function normalizeGeneral(value: RecordValue) {
  omitNull(value, ["festivalCountries"]);
  if (value.decision === "targets") {
    for (const slot of [value.previousEdition, value.currentOrNextEdition]) {
      if (!record(slot) || !record(slot.fields)) {
        continue;
      }
      omitNull(slot.fields, [
        "year",
        "dates",
        "scheduleStatus",
        "displayName",
        "sizeEstimate",
      ]);
    }
  }
}
function normalizeTickets(value: RecordValue) {
  if (record(value.currentOrNextEdition)) {
    omitNull(value.currentOrNextEdition, ["tickets"]);
    const tickets = value.currentOrNextEdition.tickets;
    if (record(tickets) && tickets.action === "set" && record(tickets.value)) {
      omitNull(tickets.value.basePrice, ["qualification"]);
      if (Array.isArray(tickets.value.variants)) {
        for (const offer of tickets.value.variants) {
          omitNull(offer, ["amount", "currency", "terms", "availability"]);
        }
      }
    }
  }
}
function normalizeClassification(value: RecordValue) {
  omitNull(value, ["description", "shortDescription"]);
  for (const slot of [value.previousEdition, value.currentOrNextEdition]) {
    omitNull(slot, ["classification"]);
    if (record(slot)) {
      omitNull(slot.classification, ["reuseFrom"]);
    }
  }
}
function normalizeLinks(value: RecordValue) {
  omitNull(value.event, ["website"]);
  if (record(value.event)) {
    omitNull(value.event.socials, [
      "instagram",
      "facebook",
      "youtube",
      "tiktok",
      "x",
      "other",
    ]);
  }
  omitNull(value.currentOrNextEdition, ["tickets"]);
}
