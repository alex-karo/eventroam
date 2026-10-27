import posthog from "posthog-js";

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

const preference = new URLSearchParams(window.location.search).get("analytics");

if (projectToken && host) {
  posthog.init(projectToken, {
    api_host: host,
    defaults: "2026-01-30",
    capture_exceptions: true,
    opt_out_capturing_persistence_type: "localStorage",
    opt_out_capturing_by_default: preference === "off",
    ...(preference === "off" && { capture_pageview: false }),
    loaded: (client) => {
      if (preference === "off") {
        client.opt_out_capturing();
      } else if (preference === "on") {
        client.opt_in_capturing();
      }
    },
    debug: process.env.NODE_ENV === "development",
  });
}
