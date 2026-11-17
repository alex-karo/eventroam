import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createElement as h } from "react";
import { ImageResponse } from "next/og.js";

const root = new URL("../", import.meta.url);
const ink = "#151522";
const coral = "#e96851";
const accent = "#5144b5";
const tint = "#dcd9fa";
const logo = await readFile(new URL("src/app/icon.svg", root));
const font = await readFile(
  new URL("assets/space-grotesk-semibold.ttf", import.meta.url),
);
const logoUrl = `data:image/svg+xml;base64,${logo.toString("base64")}`;

for (const directory of ["public/brand/", "public/social/"]) {
  await mkdir(new URL(directory, root), { recursive: true });
}

async function png(element, width, height) {
  const response = new ImageResponse(element, {
    width,
    height,
    fonts: [{ name: "Space Grotesk", data: font, weight: 600 }],
  });
  return Buffer.from(await response.arrayBuffer());
}

function icon(size, solid = false, inset = 0) {
  return h(
    "div",
    {
      style: {
        display: "flex",
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        background: solid ? ink : "transparent",
      },
    },
    h("img", {
      src: logoUrl,
      width: size - inset * 2,
      height: size - inset * 2,
    }),
  );
}

// ICO entries contain complete PNG images at each size.
const sizes = [16, 32, 48];
const frames = [];
for (const size of sizes) {
  frames.push(await png(icon(size), size, size));
}
const directory = Buffer.alloc(6 + sizes.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(sizes.length, 4);
let offset = directory.length;
for (const [index, frame] of frames.entries()) {
  const entry = 6 + index * 16;
  directory[entry] = sizes[index];
  directory[entry + 1] = sizes[index];
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(frame.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += frame.length;
}
await writeFile(
  new URL("src/app/favicon.ico", root),
  Buffer.concat([directory, ...frames]),
);

for (const [path, size, solid, inset] of [
  ["src/app/apple-icon.png", 180, true, 0],
  ["public/brand/icon-192.png", 192, false, 0],
  ["public/brand/icon-512.png", 512, false, 0],
  ["public/social/avatar.png", 1080, true, 160],
]) {
  await writeFile(
    new URL(path, root),
    await png(icon(size, solid, inset), size, size),
  );
}

const map = `<svg xmlns="http://www.w3.org/2000/svg" width="384" height="518" viewBox="0 0 384 518">
  <rect width="384" height="518" fill="${tint}"/>
  <defs><pattern id="grid" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M64 0H0V64" fill="none" stroke="${accent}" stroke-opacity=".14"/></pattern></defs>
  <rect width="384" height="518" fill="url(#grid)"/>
  <path d="M0 96H64Q96 96 96 128V390Q96 422 128 422H384" fill="none" stroke="#fff" stroke-width="8"/>
  <circle cx="64" cy="96" r="9" fill="${coral}"/>
  <circle cx="320" cy="422" r="9" fill="${coral}"/>
</svg>`;
const mapUrl = `data:image/svg+xml;base64,${Buffer.from(map).toString("base64")}`;

function socialCard({ heading, emphasis, description, domain }) {
  return h(
    "div",
    {
      style: {
        display: "flex",
        width: 1200,
        height: 630,
        position: "relative",
        background: "#fafafc",
        color: ink,
        fontFamily: "Space Grotesk",
        fontWeight: 600,
      },
    },
    h(
      "div",
      {
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          width: 1200,
          height: 112,
          display: "flex",
          alignItems: "center",
          paddingLeft: 64,
          background: ink,
          color: "white",
          fontSize: 38,
          letterSpacing: -1.8,
        },
      },
      "Eventroam",
      h("span", { style: { color: coral } }, "."),
    ),
    h("img", {
      src: mapUrl,
      width: 384,
      height: 518,
      style: { position: "absolute", left: 816, top: 112 },
    }),
    h("img", {
      src: logoUrl,
      width: 256,
      height: 256,
      style: { position: "absolute", left: 880, top: 242 },
    }),
    h(
      "div",
      {
        style: {
          position: "absolute",
          left: 64,
          top: 191,
          display: "flex",
          flexDirection: "column",
          fontSize: 72,
          lineHeight: 1.06,
          letterSpacing: -3.4,
        },
      },
      h("div", null, heading),
      h("div", { style: { color: accent } }, emphasis),
    ),
    h(
      "div",
      {
        style: {
          position: "absolute",
          left: 64,
          top: 393,
          width: 650,
          color: "#60606f",
          fontSize: 24,
          lineHeight: 1.45,
          whiteSpace: "pre-wrap",
        },
      },
      description,
    ),
    h("div", {
      style: {
        position: "absolute",
        left: 64,
        top: 530,
        width: 688,
        height: 1,
        background: "#dedee7",
      },
    }),
    h(
      "div",
      {
        style: {
          position: "absolute",
          left: 64,
          top: 556,
          fontSize: 21,
          color: ink,
        },
      },
      domain,
    ),
  );
}

for (const [name, content] of Object.entries({
  eventroam: {
    heading: "A catalog of",
    emphasis: "structured data.",
    description:
      "From web sources to one catalog.\nAgents collect new records and keep them up to date.",
    domain: "eventroam.org",
  },
  festivals: {
    heading: "Find your",
    emphasis: "next festival.",
    description: "Dates, places, and event details.\nExplore the list and map.",
    domain: "festivals.eventroam.org",
  },
})) {
  await writeFile(
    new URL(`public/social/${name}.png`, root),
    await png(socialCard(content), 1200, 630),
  );
}

console.log("Generated favicon, device icons, avatar, and social cards.");
