import { readFileSync } from "node:fs";

const { total } = JSON.parse(
  readFileSync(
    new URL("../coverage/coverage-summary.json", import.meta.url),
    "utf8",
  ),
);
console.log("## Test coverage\n");
console.log("Unit and integration tests; e2e excluded.\n");
console.log("| Metric | Coverage | Covered / Total |");
console.log("| --- | ---: | ---: |");
for (const metric of ["statements", "branches", "functions", "lines"]) {
  const { pct, covered, total: count } = total[metric];
  console.log(`| ${metric} | ${pct}% | ${covered} / ${count} |`);
}
console.log(
  "\nDownload the **test-coverage** artifact for the HTML report. Child-process coverage is not merged.",
);
