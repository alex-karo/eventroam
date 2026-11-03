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
/** Restore the optional fields in the known role transport contracts. */
export function normalizeRoleWire(role: Role, raw: unknown): unknown {
  const value = structuredClone(raw);
  if (!record(value)) {
    return value;
  }
  if (
    ["general", "tickets", "classification", "links", "editor"].includes(
      role,
    ) &&
    Array.isArray(value.unresolved)
  ) {
    for (const question of value.unresolved) {
      omitNull(question, ["editionKey", "field"]);
    }
  }
  if (role === "general") {
    normalizeGeneral(value);
  }
  if (role === "tickets") {
    normalizeTickets(value);
  }
  if (role === "classification") {
    normalizeClassification(value);
  }
  if (role === "links") {
    normalizeLinks(value);
  }
  return value;
}

function normalizeGeneral(value: RecordValue) {
  if (value.decision === "targets") {
    omitNull(value.event, ["summary"]);
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
