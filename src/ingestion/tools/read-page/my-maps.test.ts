import { expect, test } from "vitest";
import portamerica from "./fixtures/portamerica.json";
import handpicked from "./fixtures/handpicked.json";
import mountain from "./fixtures/mountain-music.json";
import { mapReference } from "./maps";
import { myMapMarkdown, parseMyMap } from "./my-maps";

const html = (data: unknown) =>
  `var _pageData = ${JSON.stringify(JSON.stringify(data))};`;

test("recorded maps retain labels, layers, points and years", () => {
  const port = myMapMarkdown(parseMyMap(html(portamerica.pageData)));
  expect(port).toContain("PortAmérica");
  expect(port).toContain("-8.6557329");
  expect(port).toContain("42.5906854");
  const mm = myMapMarkdown(parseMyMap(html(mountain.pageData)));
  expect(mm).toContain("2024");
  expect(mm).toContain("Venue: Buchanan Park");
  expect(mm).toContain("39.6858145");
  expect(mm).toContain("Venue and Parking");
  const hp = myMapMarkdown(parseMyMap(html(handpicked.pageData)));
  for (const label of [
    "Stage",
    "Festival Entry Gate",
    "Carpark 1",
    "Camping",
  ]) {
    expect(hp).toContain(label);
  }
  expect(hp).toContain("Lines and polygons were skipped");
  expect(hp).not.toContain("-35.319740264541245");
  expect(hp).not.toContain("Festival Site · latitude");
});

test("full records decide geometry and repeated IDs do not repeat a point", () => {
  const data = structuredClone(mountain.pageData);
  const map = data[1] as unknown[];
  const layer = (map[6] as unknown[][])[0];
  const full = (layer[12] as unknown[][])[0][13] as unknown[][];
  full[0].push(full[0][0]);
  layer[4] = [[[[-35.319740264541245, 139.04343729381495]]]];
  const result = parseMyMap(html(data));
  expect(result.layers[0].points).toHaveLength(2);
  expect(myMapMarkdown(result)).not.toContain("-35.319740264541245");
});

test.each([
  "",
  "var _pageData = invalid;",
  html([]),
  html([null, { layers: [] }]),
])("unsupported input fails explicitly", (body) => {
  expect(() => parseMyMap(body)).toThrow("unsupported_map_data");
});

test("invalid point coordinates fail rather than reporting absence", () => {
  const body = html(mountain.pageData).replace("39.6858145", "999");
  expect(() => parseMyMap(body)).toThrow("unsupported_map_data");
});

test("a supported empty map reports no point markers", () => {
  const map = [null, [null, null, "Empty", null, null, null, []]];
  expect(myMapMarkdown(parseMyMap(html(map)))).toContain(
    "No point markers were extracted",
  );
});

test("My Maps forms normalize by mid and reject lookalike hosts", () => {
  for (const form of ["embed", "viewer", "edit", "u/0/viewer"]) {
    expect(
      mapReference(
        `https://www.google.com/maps/d/${form}?mid=map-ID&usp=sharing`,
        "https://festival.example",
      ),
    ).toMatchObject({
      mid: "map-ID",
      url: "https://www.google.com/maps/d/viewer?mid=map-ID",
    });
  }
  expect(
    mapReference(
      "https://www.google.com.evil.test/maps/d/embed?mid=map",
      "https://festival.example",
    ),
  ).toBeNull();
});
