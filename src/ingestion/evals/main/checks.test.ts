import { expect, test } from "vitest";
import { offerChecks } from "./checks";

test.each([
  [2650, "correct"],
  [2651, "wrong"],
])("ticket label can vary, but price must match: %s", (amount, status) => {
  const url =
    "https://ticket.roskilde-festival.dk/da/vgkw6td2h3rrfkv/products?c=fz3fh09";
  const checks = offerChecks(
    {
      priceDetails: [
        {
          label: "Partoutbillet — all eight days",
          amount,
          currency: "DKK",
          url,
        },
      ],
    },
    [{ urls: [url], amounts: [2650], currency: "DKK" }],
  );
  expect(checks).toMatchObject([{ status }]);
});
