import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/site/server/metadata";
import { requestSite } from "@/site/server/public-request";

export async function generateMetadata(): Promise<Metadata> {
  const { site, origins } = await requestSite();
  return pageMetadata(
    "Privacy policy | Eventroam",
    "How Eventroam uses website data and how to control analytics.",
    `${origins[site]}/privacy`,
  );
}

export default async function PrivacyPage() {
  await requestSite();
  return (
    <main className="catalog privacy-page">
      <nav aria-label="Breadcrumb">
        <Link href="/">Back to Eventroam</Link>
      </nav>
      <h1>Privacy policy</h1>
      <p>Last updated: 28 October 2026</p>
      <p className="privacy-summary">
        We use basic statistics to improve Eventroam. Allow cookies enables
        return-visit analysis. You can also disable analytics. We do not create
        person profiles or record sessions.
      </p>
      <section>
        <h2>Who runs this website</h2>
        <p>
          Aleksandr Ivanov runs Eventroam, including eventroam.org and
          festivals.eventroam.org, and decides how website data is used. For
          privacy questions or requests, email{" "}
          <a href="mailto:hello@eventroam.org">hello@eventroam.org</a>.
        </p>
      </section>
      <section>
        <h2>Why we use data</h2>
        <p>
          We use request data to deliver and protect the website. We use basic
          usage statistics to understand which pages and features are useful and
          to improve the catalog. We use a persistent analytics
          identifier only with your consent.
        </p>
      </section>
      <section>
        <h2>Website analytics</h2>
        <p>
          PostHog counts page views and actions in the catalog. Events include
          page paths, referring sources, campaign details, browser and device
          data, and action counts. We exclude search text and remove query
          strings and fragments from analytics URLs.
        </p>
        <p>
          Before you choose and with Basic statistics, analytics uses no persistent
          tracking identifier in your browser. PostHog receives your IP address and browser data and uses
          a daily identifier to count visitors and link events within a day.
          This does not make the data fully anonymous. Allow cookies enables a random browser
          ID in cookies and local storage, with session data in session storage,
          to measure return visits.
        </p>
      </section>
      <section>
        <h2>Your analytics choice</h2>
        <p>
          <a href="/privacy?analytics=off">Disable analytics</a>,{" "}
          <a href="/privacy?analytics=basic">use basic statistics</a>, or{" "}
          <a href="/privacy?analytics=on">allow cookies</a>. You can change your
          choice at any time. We save it in local storage, separately for{" "}
          <a href="https://eventroam.org/privacy?analytics=off">eventroam.org</a>{" "}
          and{" "}
          <a href="https://festivals.eventroam.org/privacy?analytics=off">
            festivals.eventroam.org
          </a>
          . Basic statistics removes the stored analytics identity. Disable analytics
          also stops new analytics events. Events collected before the change
          can finish delivery and are not deleted. If browser storage is blocked,
          your choice applies only to the current page. These controls affect
          PostHog analytics; hosting, security, and map requests still operate.
        </p>
      </section>
      <section>
        <h2>Website storage and providers</h2>
        <p>
          Discovery uses session storage to restore filters and navigation in
          the current tab. The providers below process data to operate the site.
        </p>
        <div className="privacy-table-scroll">
          <table>
            <caption>Website service providers</caption>
            <thead>
              <tr>
                <th scope="col">Provider</th>
                <th scope="col">Purpose</th>
                <th scope="col">Data processed</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">
                  <a href="https://posthog.com/privacy">PostHog</a>
                </th>
                <td>Website analytics, EU project</td>
                <td>Usage events, request data, and browser ID after Allow cookies</td>
              </tr>
              <tr>
                <th scope="row">
                  <a href="https://www.hetzner.com/legal/privacy-policy/">
                    Hetzner
                  </a>
                </th>
                <td>Website hosting</td>
                <td>Server and network request data</td>
              </tr>
              <tr>
                <th scope="row">
                  <a href="https://www.cloudflare.com/privacypolicy/">
                    Cloudflare
                  </a>
                </th>
                <td>Content delivery and protection</td>
                <td>IP address and web request data</td>
              </tr>
              <tr>
                <th scope="row">
                  <a href="https://www.mapbox.com/legal/privacy">Mapbox</a>
                </th>
                <td>Maps, when available</td>
                <td>IP address, browser details, and map requests</td>
              </tr>
            </tbody>
          </table>
        </div>

      </section>
      <section>
        <h2>Storage and your rights</h2>
        <p>
          Analytics events are available for analysis for up to one year in
          PostHog. This is not a guaranteed deletion period. Server logs support
          operation and security and currently have no fixed deletion period.
        </p>
        <p>
          You can request access, correction, deletion, or limits on the use of
          your personal data at{" "}
          <a href="mailto:hello@eventroam.org">hello@eventroam.org</a>. Where
          applicable, you can object to processing based on legitimate interests
          and complain to your data protection authority. We may be unable to
          link cookieless events to you.
        </p>
      </section>
    </main>
  );
}
