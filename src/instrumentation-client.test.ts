// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.mock("posthog-js", () => ({
  default: {
    init: vi.fn(),
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
  },
}));

let instanceNumber = 0;
let client: import("posthog-js").PostHog | undefined;
beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  localStorage.clear();
  sessionStorage.clear();
  for (const cookie of document.cookie.split(";")) {
    document.cookie = `${cookie.split("=")[0]}=; Max-Age=0; path=/`;
  }
  window.history.replaceState(null, "", "/");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://analytics.example.test");
  vi.stubEnv("NODE_ENV", "test");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
});
afterEach(async () => {
  await client?.shutdown();
  client = undefined;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function initialize() {
  const { PostHog } =
    await vi.importActual<typeof import("posthog-js")>("posthog-js");
  const { default: posthog } = await import("posthog-js");
  vi.mocked(posthog.init).mockImplementation((token, config) => {
    client = new PostHog().init(
      token,
      {
        ...config,
        request_batching: false,
        disable_external_dependency_loading: true,
      },
      `privacy_test_${instanceNumber++}`,
    );
    return client!;
  });
  vi.mocked(posthog.opt_in_capturing).mockImplementation((options) =>
    client!.opt_in_capturing(options),
  );
  vi.mocked(posthog.opt_out_capturing).mockImplementation(() =>
    client!.opt_out_capturing(),
  );
  await import("./instrumentation-client");
  return posthog;
}

function expectCookieless() {
  const page = client!.capture("$pageview");
  expect(page?.properties.distinct_id).toBe("$posthog_cookieless");
  expect(page?.properties.$process_person_profile).toBe(false);
  expect(
    Object.keys(localStorage).filter(
      (key) => key !== "eventroam.analytics.choice",
    ),
  ).toEqual([]);
  expect(Object.keys(sessionStorage)).toEqual([]);
  expect(document.cookie).toBe("");
}

test("pending and rejected visitors get cookieless events with limited payloads", async () => {
  window.history.replaceState(
    null,
    "",
    "/?q=private-search&utm_source=github&gclid=private-ad&fbclid=private-social#private-fragment",
  );
  await initialize();
  expectCookieless();
  expect(client!.get_explicit_consent_status()).toBe("pending");
  expect(localStorage.length).toBe(0);
  const page = client!.capture("$pageview");
  expect(page?.properties.$current_url).toBe(window.location.origin + "/");
  for (const secret of [
    "private-search",
    "private-fragment",
    "private-ad",
    "private-social",
  ]) {
    expect(JSON.stringify(page)).not.toContain(secret);
  }
  expect(page?.properties.utm_source).toBe("github");
  expect(
    client!.capture("$pageview", { ph_keyword: "private-term" })?.properties
      .ph_keyword,
  ).toBeUndefined();
  expect(
    client!.capture("discovery_filters_applied", { result_count: 3 })
      ?.properties.result_count,
  ).toBe(3);
  expect(client!.capture("$autocapture")).toBeUndefined();
  expect(client!.capture("$exception")).toBeUndefined();
  const { chooseAnalytics } = await import("./site/analytics-client");
  chooseAnalytics("rejected");
  expectCookieless();
  expect(client!.get_explicit_consent_status()).toBe("denied");
});

test("Accept creates a persistent ID; Reject removes it; accepting again creates a new ID", async () => {
  await initialize();
  const { chooseAnalytics, initializeAnalytics } =
    await import("./site/analytics-client");
  chooseAnalytics("accepted");
  const id = client!.get_distinct_id();
  expect(id).not.toBe("$posthog_cookieless");
  expect(localStorage.getItem("ph_phc_test_posthog")).toContain(id);
  expect(decodeURIComponent(document.cookie)).toContain(id);
  expect(client!.config.person_profiles).toBe("never");
  expect(client!.config.disable_session_recording).toBe(true);
  client!.identify("must-not-create-a-profile");
  expect(client!.get_distinct_id()).toBe(id);
  expect(client!.capture("$pageview")?.properties.$process_person_profile).toBe(
    false,
  );
  chooseAnalytics("rejected");
  expectCookieless();
  chooseAnalytics("accepted");
  expect(client!.get_distinct_id()).not.toBe(id);
  initializeAnalytics();
  const { default: posthog } = await import("posthog-js");
  expect(posthog.init).toHaveBeenCalledOnce();
});

test("saved acceptance restores the same ID on reload", async () => {
  await initialize();
  const { chooseAnalytics } = await import("./site/analytics-client");
  chooseAnalytics("accepted");
  const id = client!.get_distinct_id();
  await client!.shutdown();
  vi.resetModules();
  await initialize();
  expect(client!.get_distinct_id()).toBe(id);
});

test("URL controls persist rejection and acceptance across reloads", async () => {
  window.history.replaceState(null, "", "/?analytics=basic");
  await initialize();
  expectCookieless();
  expect(localStorage.getItem("eventroam.analytics.choice")).toBe("0");
  await client!.shutdown();
  vi.resetModules();
  window.history.replaceState(null, "", "/");
  await initialize();
  expectCookieless();
  expect(client!.get_explicit_consent_status()).toBe("denied");
  await client!.shutdown();
  vi.resetModules();
  window.history.replaceState(null, "", "/?analytics=on");
  await initialize();
  expect(client!.get_distinct_id()).not.toBe("$posthog_cookieless");
  expect(localStorage.getItem("eventroam.analytics.choice")).toBe("1");
});

test("shared choice changes reconcile identity before later events in another tab", async () => {
  await initialize();
  localStorage.setItem("eventroam.analytics.choice", "1");
  expect(client!.capture("$pageview")?.properties.distinct_id).not.toBe(
    "$posthog_cookieless",
  );
  localStorage.setItem("eventroam.analytics.choice", "0");
  expectCookieless();
});

test("blocked storage keeps the page choice and uses cookieless capture", async () => {
  await initialize();
  const blocked = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("Blocked");
    });
  try {
    const { chooseAnalytics } = await import("./site/analytics-client");
    const { getAnalyticsChoice } = await import("./site/analytics");
    chooseAnalytics("accepted");
    expect(getAnalyticsChoice()).toBe("accepted");
    expectCookieless();
    chooseAnalytics("rejected");
    expect(getAnalyticsChoice()).toBe("rejected");
    expectCookieless();
  } finally {
    blocked.mockRestore();
  }
});

test("missing configuration does not initialize analytics", async () => {
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
  const posthog = await initialize();
  expect(posthog.init).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});

test("accepted events exclude query, fragment, and referrer search data across reloads and navigation", async () => {
  vi.spyOn(document, "referrer", "get").mockReturnValue(
    "https://www.google.com/search?q=private-referrer-term#private-referrer-fragment",
  );
  window.history.replaceState(
    null,
    "",
    "/?q=private-search&utm_source=github&gclid=private-ad#private-fragment",
  );
  await initialize();
  const { chooseAnalytics } = await import("./site/analytics-client");
  chooseAnalytics("accepted");
  function checkPayload() {
    const page = client!.capture("$pageview");
    expect(page?.properties.distinct_id).not.toBe("$posthog_cookieless");
    expect(page?.properties.utm_source).toBe("github");
    const payload = JSON.stringify(page);
    for (const secret of [
      "private-search",
      "private-referrer-term",
      "private-referrer-fragment",
      "private-ad",
      "private-fragment",
      "private-next-search",
      "private-next-fragment",
    ]) {
      expect(payload).not.toContain(secret);
    }
    return page;
  }
  const first = checkPayload();
  expect(first?.properties.$session_entry_url).toBe(
    window.location.origin + "/",
  );
  expect(first?.properties.$session_entry_referrer).toBe(
    "https://www.google.com/search",
  );
  expect(first?.properties.$session_entry_ph_keyword).toBeUndefined();
  await client!.shutdown();
  vi.resetModules();
  await initialize();
  checkPayload();
  window.history.replaceState(
    null,
    "",
    "/privacy?q=private-next-search#private-next-fragment",
  );
  checkPayload();
});

test("full opt-out blocks capture from each mode and can be reversed", async () => {
  await initialize();
  const { chooseAnalytics } = await import("./site/analytics-client");
  for (const previous of ["rejected", "accepted"] as const) {
    chooseAnalytics(previous);
    vi.mocked(fetch).mockClear();
    chooseAnalytics("disabled");
    expect(client!.capture("$pageview")).toBeUndefined();
    expect(
      client!.capture("discovery_filters_applied", { result_count: 3 }),
    ).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
    expect(document.cookie).toBe("");
    expect(Object.keys(sessionStorage)).toEqual([]);
    expect(Object.keys(localStorage)).toEqual(["eventroam.analytics.choice"]);
    expect(localStorage.getItem("eventroam.analytics.choice")).toBe("disabled");
    chooseAnalytics("rejected");
    expectCookieless();
    chooseAnalytics("accepted");
    expect(client!.capture("$pageview")?.properties.distinct_id).not.toBe(
      "$posthog_cookieless",
    );
  }
});

test("off URL blocks the first page view, clears identity, and survives reload", async () => {
  await initialize();
  const { chooseAnalytics } = await import("./site/analytics-client");
  chooseAnalytics("accepted");
  const savedCookies = document.cookie;
  const savedStorage = { ...localStorage };
  await client!.shutdown();
  for (const [key, value] of Object.entries(savedStorage)) {
    localStorage.setItem(key, value);
  }
  for (const cookie of savedCookies.split("; ")) {
    document.cookie = `${cookie}; path=/`;
  }
  vi.resetModules();
  window.history.replaceState(null, "", "/privacy?analytics=off");
  vi.mocked(fetch).mockClear();
  await initialize();
  expect(client!.capture("$pageview")).toBeUndefined();
  expect(fetch).not.toHaveBeenCalled();
  expect(document.cookie).toBe("");
  expect(Object.keys(sessionStorage)).toEqual([]);
  await client!.shutdown();
  vi.resetModules();
  window.history.replaceState(null, "", "/");
  await initialize();
  expect(client!.capture("$pageview")).toBeUndefined();
  expect(fetch).not.toHaveBeenCalled();
});

test("full opt-out in another tab blocks subsequent captures", async () => {
  await initialize();
  const { chooseAnalytics } = await import("./site/analytics-client");
  chooseAnalytics("accepted");
  localStorage.setItem("eventroam.analytics.choice", "disabled");
  vi.mocked(fetch).mockClear();
  expect(client!.capture("$pageview")).toBeUndefined();
  expect(client!.capture("promo_link_clicked")).toBeUndefined();
  expect(fetch).not.toHaveBeenCalled();
  expect(document.cookie).toBe("");
  expect(Object.keys(sessionStorage)).toEqual([]);
});

test("full opt-out blocks capture when preference storage is blocked", async () => {
  await initialize();
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("Blocked");
  });
  const { chooseAnalytics } = await import("./site/analytics-client");
  chooseAnalytics("disabled");
  vi.mocked(fetch).mockClear();
  expect(client!.capture("$pageview")).toBeUndefined();
  expect(fetch).not.toHaveBeenCalled();
  const { getAnalyticsChoice } = await import("./site/analytics");
  expect(getAnalyticsChoice()).toBe("disabled");
});
