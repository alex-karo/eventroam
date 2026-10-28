import posthog from "posthog-js";
import {
  getAnalyticsChoice,
  limitAnalyticsEvent,
  preferenceKey,
  setAnalyticsChoice,
  type AnalyticsChoice,
} from "@/site/analytics";

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

let initialized = false;
let disabling = false;

export function initializeAnalytics() {
  clearCookielessSessionStorage();
  if (initialized || !projectToken || !host) {
    return;
  }
  initialized = true;
  posthog.init(projectToken, {
    api_host: host,
    defaults: "2026-01-30",
    cookieless_mode: "on_reject",
    opt_out_capturing_by_default: true,
    consent_persistence_name: preferenceKey,
    cross_subdomain_cookie: false,
    person_profiles: "never",
    mask_personal_data_properties: true,
    disable_session_recording: true,
    autocapture: false,
    capture_exceptions: false,
    capture_performance: false,
    capture_heatmaps: false,
    capture_dead_clicks: false,
    rageclick: false,
    capture_pageview: "history_change",
    capture_pageleave: false,
    disable_surveys: true,
    disable_conversations: true,
    disable_product_tours: true,
    advanced_disable_flags: true,
    before_send: (event) => {
      clearCookielessSessionStorage();
      return disabling ? null : limitAnalyticsEvent(event);
    },
    debug: process.env.NODE_ENV === "development",
  });
}

export function chooseAnalytics(choice: Exclude<AnalyticsChoice, null>) {
  // The SDK writes its consent value before it emits a transition page view.
  disabling = choice === "disabled";
  try {
    if (disabling) {setAnalyticsChoice(choice);}
    initializeAnalytics();
    if (initialized) {
      if (choice === "accepted") {
        posthog.opt_in_capturing({ captureEventName: false });
      } else {
        posthog.opt_out_capturing();
      }
    }
  } finally {
    setAnalyticsChoice(choice);
    clearCookielessSessionStorage();
    disabling = false;
  }
}

function clearCookielessSessionStorage() {
  if (getAnalyticsChoice() === "accepted" || !projectToken) {
    return;
  }
  try {
    window.sessionStorage.removeItem(`ph_${projectToken}_window_id`);
    window.sessionStorage.removeItem(`ph_${projectToken}_primary_window_exists`);
  } catch {
    // Storage can be blocked by the browser.
  }
}
