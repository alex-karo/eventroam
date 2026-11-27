import type { ReactNode } from "react";
import styles from "./data-process.module.css";

function StageArrow() {
  return (
    <div className={styles.connector} aria-hidden="true">
      <svg viewBox="0 0 24 16" width="24" height="16">
        <path d="M3 8H20 M15 3L20 8L15 13" />
      </svg>
    </div>
  );
}

export function DataProcess({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <figure className={styles.figure}>
      <figcaption>
        <h2 className={styles.captionTitle}>
          From festival notices to a catalog update
        </h2>
      </figcaption>

      <div className={styles.flow}>
        <div className={styles.stage}>
          <h3 className={styles.stageTitle}>Organizer notices</h3>
          <ul className={styles.sources} role="list">
            <li className={styles.snippet}>
              <time dateTime="2026-09-25">25 Sep 2026</time>
              <a
                href="https://marcopolofest.hr/hr/novosti/31-marko-polo-festival-odgada-se-za-novi-termin"
                target="_blank"
                rel="noopener noreferrer"
              >
                Delay notice
              </a>
              <p>The organizer postponed the 31st edition.</p>
            </li>
            <li className={styles.snippet}>
              <time dateTime="2026-10-12">12 Oct 2026</time>
              <a
                href="https://marcopolofest.hr/hr/novosti/31-marko-polo-festival-vidimo-se-27-studenoga"
                target="_blank"
                rel="noopener noreferrer"
              >
                New date notice
              </a>
              <p>The 31st edition moved to 27 November.</p>
            </li>
          </ul>
        </div>

        <StageArrow />

        <div className={styles.stage}>
          <h3 className={styles.stageTitle}>Match and verify</h3>
          <dl className={styles.checks}>
            <div>
              <dt>Same edition</dt>
              <dd>Both notices name the 31st edition.</dd>
            </div>
            <div>
              <dt>Full event date</dt>
              <dd>
                The{" "}
                <a
                  href="https://marcopolofest.hr/hr/program"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  festival programme
                </a>{" "}
                lists the full event on one evening, 27 November.
              </dd>
            </div>
          </dl>
        </div>

        <StageArrow />

        <div className={styles.stage}>
          <h3 className={styles.stageTitle}>Published record</h3>
          <div className={styles.record}>
            <strong>Marco Polo Fest 2026</strong>
            <dl className={styles.fields}>
              <div>
                <dt>Date</dt>
                <dd>
                  <time dateTime="2026-11-27">27 Nov 2026</time>
                </dd>
              </div>
              <div>
                <dt>Venue</dt>
                <dd>Centar za kulturu Korčula</dd>
              </div>
              <div className={styles.changed}>
                <dt>Status</dt>
                <dd>
                  Postponed <span aria-hidden="true">→</span>
                  <span className="sr-only"> to </span> Scheduled
                </dd>
              </div>
            </dl>
            <p>
              The date was already in the record. We updated the status on{" "}
              <time dateTime="2026-11-17">17 Nov 2026</time>.
            </p>
            {children}
          </div>
        </div>
      </div>
    </figure>
  );
}
