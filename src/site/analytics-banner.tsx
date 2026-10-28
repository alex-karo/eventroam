"use client";

import { useEffect, useRef, useState } from "react";
import {
  getAnalyticsChoice,
  type AnalyticsChoice,
} from "@/site/analytics";
import { chooseAnalytics, initializeAnalytics } from "@/site/analytics-client";

export function AnalyticsBanner() {
  const [choice, setChoice] = useState<AnalyticsChoice | "loading">("loading");
  const banner = useRef<HTMLElement>(null);

  useEffect(() => {
    const sync = () => {
      setChoice(getAnalyticsChoice());
      initializeAnalytics();
    };
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  useEffect(() => {
    const element = banner.current;
    if (!element) {return;}
    const resize = new ResizeObserver(() => {
      document.documentElement.style.setProperty(
        "--analytics-banner-height",
        `${element.offsetHeight}px`,
      );
    });
    resize.observe(element);
    return () => {
      resize.disconnect();
      document.documentElement.style.removeProperty(
        "--analytics-banner-height",
      );
    };
  }, [choice]);

  if (choice !== null) {return null;}

  function choose(next: Exclude<AnalyticsChoice, null>) {
    chooseAnalytics(next);
    setChoice(next);
    initializeAnalytics();
  }

  return (
    <aside
      ref={banner}
      className="analytics-banner"
      aria-label="Analytics choice"
    >
      <p>
        We use basic statistics to improve Eventroam. Allow cookies to help us
        understand return visits, keep basic statistics, or disable analytics.{" "}
        <a href="/privacy">Learn more</a>
      </p>
      <div className="analytics-banner-actions">
        <button type="button" onClick={() => choose("disabled")}>
          Disable analytics
        </button>
        <button type="button" onClick={() => choose("rejected")}>
          Basic statistics
        </button>
        <button type="button" onClick={() => choose("accepted")}>
          Allow cookies
        </button>
      </div>
    </aside>
  );
}
