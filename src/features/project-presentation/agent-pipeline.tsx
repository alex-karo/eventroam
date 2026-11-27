import styles from "./agent-pipeline.module.css";

function NextStage() {
  return (
    <svg
      className={styles.nextStage}
      viewBox="0 0 24 16"
      width="24"
      height="16"
      aria-hidden="true"
    >
      <path d="M3 8H20 M15 3L20 8L15 13" />
    </svg>
  );
}

export function AgentPipeline() {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>
        <h2>From supplier updates to catalog records</h2>
        <p>
          In this example, suppliers report pack size changes and discontinued
          items in spreadsheets and PDFs.
        </p>
      </figcaption>

      <ol className={styles.flow} role="list">
        <li className={styles.stage}>
          <div className={styles.card}>
            <p className={styles.label}>Extraction agent</p>
            <h3>Read supplier files</h3>
            <p>
              Read item codes, pack sizes, and availability. Keep the source for
              each value.
            </p>
          </div>
          <NextStage />
        </li>
        <li className={styles.stage}>
          <div className={styles.card}>
            <p className={styles.label}>Matching agent</p>
            <h3>Match items</h3>
            <p>Match each code to a product or flag a possible new item.</p>
          </div>
          <NextStage />
        </li>
        <li className={`${styles.stage} ${styles.validation}`}>
          <div className={styles.card}>
            <p className={styles.label}>Validation rules</p>
            <h3>Check updates</h3>
            <p>Check required fields. Flag duplicates and conflicts.</p>
          </div>
          <NextStage />
          <div className={styles.review}>
            <p className={styles.label}>Human review for conflicts</p>
            <p>
              A reviewer checks conflicting pack sizes against the sources. Then
              we validate the update again.
            </p>
          </div>
        </li>
        <li className={styles.stage}>
          <div className={`${styles.card} ${styles.output}`}>
            <p className={styles.label}>Approved records</p>
            <h3>Update the catalog</h3>
            <p>
              Show buyers what they can order and how many units each pack
              contains.
            </p>
          </div>
        </li>
      </ol>
    </figure>
  );
}
