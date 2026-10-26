import type { PublicEdition } from "@/catalog/read/contracts";
import { Icon } from "./icons";

export function linkLabel(kind: string): string {
  const labels: Record<string, string> = {
    official_site: "Official site",
    ticketing: "Tickets",
    x: "X (Twitter)",
    facebook: "Facebook",
    instagram: "Instagram",
    youtube: "YouTube",
    tiktok: "TikTok",
    other: "External link",
    spotify: "Spotify",
    soundcloud: "SoundCloud",
    telegram: "Telegram",
    email: "Email",
    map: "Open location",
  };
  return labels[kind] ?? kind.replaceAll("_", " ");
}
export function namedLinks(
  links: PublicEdition["links"],
  historicalYear?: number,
) {
  const unique = links.filter(
    (link, index) =>
      links.findIndex((other) => other.url === link.url) === index,
  );
  const names = unique.map((link) => {
    const base = link.label || linkLabel(link.kind);
    const year =
      link.kind === "ticketing" && historicalYear ? ` (${historicalYear})` : "";
    return `${base}${year}`;
  });
  const qualified = unique.map((link, index) => {
    if (names.filter((name) => name === names[index]).length < 2) {
      return names[index];
    }
    let host: string;
    try {
      host = new URL(link.url).hostname;
    } catch {
      host = link.url;
    }
    return `${names[index]} · ${host}`;
  });
  return unique.map((link, index) => ({
    ...link,
    name:
      qualified.filter((name) => name === qualified[index]).length > 1
        ? `${qualified[index]} · ${link.url}`
        : qualified[index],
  }));
}
export function ExternalLinks({
  links,
  historicalYear,
}: Readonly<{ links: PublicEdition["links"]; historicalYear?: number }>) {
  if (!links.length) {
    return null;
  }
  const named = namedLinks(links, historicalYear);
  return (
    <div className="external-links" aria-label="External links">
      {named.map((link, index) => {
        let icon = link.kind;
        if (link.kind === "ticketing") {
          icon = "ticket";
        } else if (
          link.kind === "official_site" &&
          named.slice(0, index).some((item) => item.kind === "official_site")
        ) {
          icon = "info";
        }
        return (
          <a
            key={link.url}
            className="external-link"
            href={link.url}
            rel="noopener noreferrer"
            title={link.name}
            aria-label={link.name}
          >
            <Icon name={icon} />
            <span>{link.name}</span>
          </a>
        );
      })}
    </div>
  );
}
