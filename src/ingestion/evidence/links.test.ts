import { expect, it } from "vitest";
import { pageLinks } from "./links";

it("retains real navigation destinations without treating code or images as page links", () => {
  const markdown = `
[Buy **festival pass**](/shop?product=pass&edition=2027)
[Travel][trip]
[Same destination](/shop?product=pass&edition=2027)
[Email](mailto:info@example.org)
![Logo](/image.png)
\`[Not a link](/fake)\`

[trip]: ../travel
`;
  expect(pageLinks(markdown, "https://example.org/2027/index")).toEqual([
    {
      url: "https://example.org/shop?product=pass&edition=2027",
      label: "Buy festival pass",
    },
    { url: "https://example.org/travel", label: "Travel" },
  ]);
});

it.each([
  { label: `${"a".repeat(199)}🎉more`, expected: "a".repeat(199) },
  { label: `${"a".repeat(198)}🎉more`, expected: `${"a".repeat(198)}🎉` },
  { label: "a".repeat(201), expected: "a".repeat(200) },
  { label: "Festival 🎉", expected: "Festival 🎉" },
])(
  "keeps a valid Unicode label within the size limit: $label",
  ({ label, expected }) => {
    const [lead] = pageLinks(`[${label}](/tickets)`, "https://example.org");

    expect(lead.label).toBe(expected);
    expect(lead.label.length).toBeLessThanOrEqual(200);
    expect(lead.label.isWellFormed()).toBe(true);
  },
);
