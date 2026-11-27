import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { editionPath } from "@/site/site";
import { AgentPipeline } from "./agent-pipeline";
import { DataProcess } from "./data-process";
import { PromoLink } from "./promo-link";
import styles from "./project-presentation.module.css";

type Props = {
  festivalsHref: string;
};

const email = "hello@eventroam.org";

function EmailLink({
  placement,
  children,
}: Readonly<{ placement: "hero" | "footer"; children: string }>) {
  return (
    <PromoLink
      className={styles.emailLink}
      destination="email"
      placement={placement}
      href={`mailto:${email}`}
    >
      {children}
    </PromoLink>
  );
}

function CatalogLink({
  href,
  children,
}: Readonly<{ href: string; children: ReactNode }>) {
  return (
    <PromoLink
      className={styles.textLink}
      href={href}
      destination="festivals"
      placement="example"
    >
      {children}
    </PromoLink>
  );
}

function PresentationLayout({
  children,
  service,
}: Readonly<{
  children: ReactNode;
  service?: "data" | "custom-systems";
}>) {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <Link
            className={styles.brand}
            href="/"
            aria-current={service ? undefined : "page"}
          >
            Eventroam<span aria-hidden="true">.</span>
          </Link>
          <nav aria-label="Services" className={styles.navigation}>
            <Link
              href="/data"
              aria-current={service === "data" ? "page" : undefined}
            >
              Data for your product
            </Link>
            <Link
              href="/custom-systems"
              aria-current={service === "custom-systems" ? "page" : undefined}
            >
              Custom agent pipelines
            </Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer className={`privacy-footer ${styles.footer}`}>
          <Link href="/privacy">Privacy policy</Link>
        </footer>
      </div>
    </div>
  );
}

function Contact({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <section className={styles.contact} aria-labelledby="contact-title">
      <div>
        <h2 id="contact-title">Work with us</h2>
        <p>{children}</p>
      </div>
      <EmailLink placement="footer">Email us about your project</EmailLink>
    </section>
  );
}

export function ProjectPresentation({ festivalsHref }: Readonly<Props>) {
  const editionHref = new URL(
    editionPath("marco-polo-fest-3f7d7e45", "2026"),
    festivalsHref,
  ).href;

  return (
    <PresentationLayout>
      <section className={styles.introduction} aria-labelledby="home-title">
        <div className={styles.introCopy}>
          <h1 id="home-title">
            Structured data <span>for your product.</span>
          </h1>
          <div>
            <p className={styles.lead}>
              We collect and update data from public sources. We deliver it to
              you or build a pipeline for your team.
            </p>
            <EmailLink placement="hero">Discuss your data needs</EmailLink>
          </div>
        </div>
      </section>

      <DataProcess>
        <CatalogLink href={editionHref}>View the catalog record</CatalogLink>
      </DataProcess>

      <div className={styles.services}>
        <section className={styles.service}>
          <h2>Data for your product</h2>
          <p>
            Use records with the details your product needs. See how our live
            festival catalog uses the same data for its listings, map, and
            festival pages.
          </p>
          <Link className={styles.textLink} href="/data">
            <span className={styles.serviceLinkLabel}>
              See how to use the data
            </span>{" "}
            <span aria-hidden="true">→</span>
          </Link>
        </section>
        <section className={styles.service}>
          <h2>Custom agent pipelines</h2>
          <p>
            Give your team an agent pipeline that reads your sources, checks
            changes, and sends approved data where you need it.
          </p>
          <Link className={styles.textLink} href="/custom-systems">
            <span className={styles.serviceLinkLabel}>
              See how an agent pipeline works
            </span>{" "}
            <span aria-hidden="true">→</span>
          </Link>
        </section>
      </div>

      <section className={styles.example} aria-labelledby="example-title">
        <div>
          <h2 id="example-title">The live festival catalog</h2>
          <p>
            Browse festivals by date and place, compare locations on a map, and
            open an edition to see its details.
          </p>
          <CatalogLink href={festivalsHref}>
            Browse the festival catalog
          </CatalogLink>
        </div>
        <figure className={styles.preview}>
          <div
            className={styles.previewScroll}
            role="region"
            aria-label="Festival catalog preview"
            tabIndex={0}
          >
            <Image
              src="/festival-catalog-globe.jpg"
              alt="Festival listings in Finland and Brazil beside a globe with festival locations."
              width={1280}
              height={720}
              sizes="(max-width: 740px) 640px, (max-width: 1200px) 62vw, 700px"
            />
          </div>
          <figcaption>Scroll the preview to see the map.</figcaption>
        </figure>
      </section>

      <Contact>
        Tell us what information you need and how you plan to use it.
      </Contact>
    </PresentationLayout>
  );
}

function ServiceIntro({
  title,
  action,
  children,
}: Readonly<{ title: string; action: string; children: ReactNode }>) {
  return (
    <section className={styles.introduction} aria-labelledby="service-title">
      <div className={styles.introCopy}>
        <h1 id="service-title">{title}</h1>
        <div>
          <p className={styles.lead}>{children}</p>
          <EmailLink placement="hero">{action}</EmailLink>
        </div>
      </div>
    </section>
  );
}

function ServiceExamples({
  title,
  children,
}: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <section
      className={styles.serviceExamples}
      aria-labelledby="examples-title"
    >
      <h2 id="examples-title">{title}</h2>
      <ul role="list" className={styles.serviceExampleList}>
        {children}
      </ul>
    </section>
  );
}

export function DataServicePage({ festivalsHref }: Readonly<Props>) {
  const editionHref = new URL(
    editionPath("eurockeennes-de-belfort-2f67bdd6", "2027"),
    festivalsHref,
  ).href;

  return (
    <PresentationLayout service="data">
      <ServiceIntro
        title="Data for your product"
        action="Discuss your data needs"
      >
        We collect and update festival data from agreed sources.
      </ServiceIntro>

      <ServiceExamples title="How teams can use festival data">
        <li>
          <h3>Tourism teams and local publishers</h3>
          <p>
            Use the same festival records in a regional calendar and weekend
            guides. Choose editions by area and date, and show which dates are
            provisional.
          </p>
        </li>
        <li>
          <h3>Travel and transport apps</h3>
          <p>
            Let travellers find a festival by name and see its dates and venue
            in your trip planner. Mark approximate pins and show the venue or
            town when a record has no coordinates.
          </p>
        </li>
        <li>
          <h3>Music publishers and festival guides</h3>
          <p>
            Help readers discover festivals by genre and browse past editions.
            Give each edition its own page with dates, venue, and ticket terms
            when available.
          </p>
        </li>
      </ServiceExamples>

      <section className={styles.caseStudy} aria-labelledby="case-title">
        <div className={styles.caseIntro}>
          <h2 id="case-title">One festival, separate editions</h2>
          <p>Eurockéennes de Belfort has separate records for 2026 and 2027.</p>
          <CatalogLink href={editionHref}>View the 2027 edition</CatalogLink>
        </div>
        <div className={styles.editions}>
          <h3>Eurockéennes de Belfort · 2027 edition</h3>
          <dl className={styles.editionRecord}>
            <div>
              <dt>Confirmed dates</dt>
              <dd>2–5 July 2027</dd>
            </div>
            <div>
              <dt>Venue</dt>
              <dd>Presqu’île du Malsaucy, France</dd>
            </div>
            <div>
              <dt>Map location</dt>
              <dd>No coordinates</dd>
            </div>
            <div>
              <dt>Passes at announcement</dt>
              <dd>Monday day ticket and limited four-day pass</dd>
            </div>
          </dl>
        </div>
      </section>

      <Contact>
        Tell us which region or sources you need, which fields your product
        uses, and how often you need updates.
      </Contact>
    </PresentationLayout>
  );
}

export function CustomSystemsPage({ festivalsHref }: Readonly<Props>) {
  const edition2026Href = new URL(
    editionPath("arctangent-f6bf9c42", "2026"),
    festivalsHref,
  ).href;
  const edition2027Href = new URL(
    editionPath("arctangent-f6bf9c42", "2027"),
    festivalsHref,
  ).href;

  return (
    <PresentationLayout service="custom-systems">
      <ServiceIntro
        title="Custom agent pipelines"
        action="Discuss your workflow"
      >
        We build pipelines that read your sources, check data against your
        rules, and send updates to your tools.
      </ServiceIntro>

      <AgentPipeline />

      <section className={styles.caseStudy} aria-labelledby="case-title">
        <div className={styles.caseIntro}>
          <h2 id="case-title">ArcTanGent’s venue change</h2>
          <p>The organizer announced a new venue for 2027.</p>
          <a
            className={styles.textLink}
            href="https://arctangent.co.uk/landing/2027"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read the organizer’s venue announcement
          </a>
        </div>
        <div className={styles.editions}>
          <h3>ArcTanGent</h3>
          <ol className={styles.editionList}>
            <li>
              <div>
                <CatalogLink href={edition2026Href}>
                  View 2026 edition
                </CatalogLink>
                <p>Fernhill Farm</p>
              </div>
            </li>
            <li>
              <div>
                <CatalogLink href={edition2027Href}>
                  View 2027 edition
                </CatalogLink>
                <p>Todenham Manor Farm, near Moreton-in-Marsh</p>
              </div>
            </li>
          </ol>
        </div>
        <p className={styles.result}>
          The pipeline checks approved changes and updates the right edition.
        </p>
      </section>

      <ServiceExamples title="Agent pipelines we can build">
        <li>
          <h3>Review supplier catalog updates</h3>
          <p>
            Check supplier catalogs for new items, price changes, and items
            marked as discontinued. Give your team the source for each update so
            they can check it before publication.
          </p>
        </li>
        <li>
          <h3>Extract requirements from documents</h3>
          <p>
            Extract deadlines and eligibility rules from program documents. Give
            reviewers the source passage for each item before they add it to a
            tracker.
          </p>
        </li>
        <li>
          <h3>Send updates to your product</h3>
          <p>
            Publish approved records on a schedule in the format your product
            uses. Keep record IDs stable so it can update existing listings.
          </p>
        </li>
      </ServiceExamples>

      <Contact>
        Send us a few sources, an example of a change your team handles, and who
        needs to review it before publication.
      </Contact>
    </PresentationLayout>
  );
}
