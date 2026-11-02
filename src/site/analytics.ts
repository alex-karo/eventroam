import type { CaptureResult } from "posthog-js";

export const preferenceKey = "eventroam.analytics.choice";
export type AnalyticsChoice = "accepted" | "rejected" | "disabled" | null;
let pageChoice: AnalyticsChoice = null;
let storageUnavailable = false;

export function getAnalyticsChoice(): AnalyticsChoice {
  if (storageUnavailable) {
    return pageChoice;
  }
  try {
    const value = window.localStorage.getItem(preferenceKey);
    if (value === "1") {
      return "accepted";
    }
    if (value === "disabled") {
      return "disabled";
    }
    return value === "0" ? "rejected" : null;
  } catch {
    return pageChoice;
  }
}

export function setAnalyticsChoice(choice: Exclude<AnalyticsChoice, null>) {
  pageChoice = choice;
  try {
    const values = { accepted: "1", rejected: "0", disabled: "disabled" };
    window.localStorage.setItem(preferenceKey, values[choice]);
  } catch {
    storageUnavailable = true;
    // Keep the choice for this page if storage is unavailable.
  }
}

export function applyAnalyticsUrlChoice() {
  const value = new URLSearchParams(window.location.search).get("analytics");
  if (value === "off" || value === "basic" || value === "on") {
    const choices = {
      on: "accepted",
      off: "disabled",
      basic: "rejected",
    } as const;
    setAnalyticsChoice(choices[value]);
  }
}

const events = new Set([
  "$pageview",
  "discovery_search_submitted",
  "discovery_filters_applied",
  "discovery_view_changed",
  "edition_details_selected",
  "promo_link_clicked",
]);

export function limitAnalyticsEvent(event: CaptureResult | null) {
  if (
    getAnalyticsChoice() === "disabled" ||
    !event ||
    !events.has(event.event)
  ) {
    return null;
  }
  for (const key of [
    "$current_url",
    "$referrer",
    "$initial_current_url",
    "$initial_referrer",
    "$session_entry_url",
    "$session_entry_referrer",
  ]) {
    const value: unknown = event.properties[key];
    if (typeof value !== "string") {
      continue;
    }
    try {
      const url = new URL(value);
      event.properties[key] = `${url.origin}${url.pathname}`;
    } catch {
      delete event.properties[key];
    }
  }
  delete event.properties.ph_keyword;
  delete event.properties.$initial_ph_keyword;
  delete event.properties.$session_entry_ph_keyword;
  return event;
}
