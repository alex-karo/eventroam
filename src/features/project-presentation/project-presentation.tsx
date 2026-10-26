import Image from "next/image";
import styles from "./project-presentation.module.css";

type Props = {
  festivalsHref: string;
};

const contactHref = "https://www.linkedin.com/in/alex-karo/";

export function ProjectPresentation({ festivalsHref }: Readonly<Props>) {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <span className={styles.brand}>
            Eventroam<span aria-hidden="true">.</span>
          </span>
          <span className={styles.headerNote}>
            From web sources to structured data
          </span>
        </header>
        <main>
          <section
            className={styles.introduction}
            aria-labelledby="system-title"
          >
            <div className={styles.introCopy}>
              <h1 id="system-title">
                A catalog of
                <br />
                <span>structured data.</span>
              </h1>
              <div>
                <p className={styles.lead}>
                  From web sources to one catalog, with agents to collect new
                  records and update existing ones.
                </p>
                <div className={styles.heroActions}>
                  <a className={styles.contactLink} href={contactHref}>
                    Contact me on LinkedIn <span aria-hidden="true">↗</span>
                  </a>
                  <a className={styles.textLink} href="#example">
                    See an example <span aria-hidden="true">↓</span>
                  </a>
                </div>
              </div>
            </div>
            <figure
              className={styles.transformation}
              aria-label="Source text becomes a structured record in a data catalog"
            >
              <div className={styles.pipeline}>
                <div className={styles.source}>
                  <p className={styles.label}>Source text</p>
                  <p className={styles.sourceTitle}>
                    Fictional Atlantic Sounds
                  </p>
                  <p>
                    Join us on <mark>June 10–12, 2027</mark> for three days of
                    music in <mark>Lisbon, Portugal.</mark>
                  </p>
                </div>
                <div className={styles.connector}>
                  <span className={styles.agentLabel}>Agents</span>
                  <span className={styles.arrow} aria-hidden="true">
                    →
                  </span>
                </div>
                <div className={styles.record}>
                  <div className={styles.recordHeading}>
                    <p className={styles.label}>Structured record</p>
                    <span className={styles.recordSymbol} aria-hidden="true">
                      &#123; &#125;
                    </span>
                  </div>
                  <dl>
                    <div>
                      <dt>Event</dt>
                      <dd>Fictional Atlantic Sounds</dd>
                    </div>
                    <div>
                      <dt>Dates</dt>
                      <dd>
                        <mark>10–12 Jun 2027</mark>
                      </dd>
                    </div>
                    <div>
                      <dt>Location</dt>
                      <dd>
                        <mark>Lisbon, Portugal</mark>
                      </dd>
                    </div>
                  </dl>
                </div>
                <div className={styles.connector} aria-hidden="true">
                  <span className={styles.arrow}>→</span>
                </div>
                <div className={styles.catalog}>
                  <p className={styles.label}>Data catalog</p>
                  <table aria-label="Illustrative data catalog">
                    <thead>
                      <tr>
                        <th scope="col">Event</th>
                        <th scope="col">Dates / Place</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Fictional Field Days</td>
                        <td>
                          1–3 Jul 2027<span>Example Valley, Portugal</span>
                        </td>
                      </tr>
                      <tr>
                        <td>Fictional Mediterranean Nights</td>
                        <td>
                          15–18 Jul 2027<span>Barcelona, Spain</span>
                        </td>
                      </tr>
                      <tr className={styles.newRecord}>
                        <td>
                          Fictional Atlantic Sounds
                          <span className={styles.newLabel}>New record</span>
                        </td>
                        <td>
                          10–12 Jun 2027<span>Lisbon, Portugal</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <figcaption>
                Illustrative example · Fictional event data
              </figcaption>
            </figure>
          </section>

          <section
            id="example"
            className={styles.example}
            aria-labelledby="example-title"
          >
            <div className={styles.exampleCopy}>
              <p className={styles.eyebrow}>From data to a product</p>
              <h2 id="example-title">
                One application:
                <br />a festival catalog
              </h2>
              <p>
                Dates, locations, and event details in a searchable catalog,
                with filters and a map.
              </p>
              <a className={styles.textLink} href={festivalsHref}>
                Explore the festival catalog <span aria-hidden="true">↗</span>
              </a>
            </div>
            <figure className={styles.preview}>
              <div
                className={styles.previewScroll}
                role="region"
                aria-label="Festival catalog preview"
                tabIndex={0}
              >
                <Image
                  src="/festival-catalog-preview.webp"
                  alt="Festival catalog with four fictional editions, search, filters, and a map. Map attribution is shown at the bottom."
                  width={900}
                  height={720}
                  sizes="(max-width: 740px) 640px, (max-width: 1200px) 62vw, 700px"
                />
              </div>
              <figcaption>
                Built with fictional event data for this demo.
                <span className={styles.scrollHint}>
                  Scroll the preview to see the map →
                </span>
              </figcaption>
            </figure>
          </section>

          <section
            className={styles.cooperation}
            aria-labelledby="services-title"
          >
            <div className={styles.sectionHeading}>
              <h2 id="services-title">Data for your product</h2>
              <p>I can apply the same approach to other types of data.</p>
            </div>
            <div className={styles.services}>
              <div>
                <p className={styles.eyebrow}>Data as a service</p>
                <h3>Get the data</h3>
                <p>
                  I collect data from agreed sources and deliver it in the
                  format your product needs.
                </p>
              </div>
              <div>
                <p className={styles.eyebrow}>Custom development</p>
                <h3>Build your own system</h3>
                <p>
                  I build a system for your sources, data structure, and
                  workflow.
                </p>
              </div>
            </div>
            <div className={styles.contact}>
              <div>
                <p className={styles.author}>Built by Alex.</p>
                <p>Tell me what data you need and how you plan to use it.</p>
              </div>
              <a className={styles.contactLink} href={contactHref}>
                Contact me on LinkedIn <span aria-hidden="true">↗</span>
              </a>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
