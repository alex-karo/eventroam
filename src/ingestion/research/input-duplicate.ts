import type Database from "better-sqlite3";
import {
  readResearchNames,
  readResearchCountries,
  readResearchOfficialLinks,
} from "@/catalog/read/research";
import { isAssignedCountryCode } from "@/catalog/domain/country-codes";

export type InputDuplicateMatch = {
  eventId: string;
  matchedName: string;
  support: { countryCode: string } | { officialUrl: string };
};

type NameRow = ReturnType<typeof readResearchNames>[number];
type NameCandidate = { eventId: string; matchedName: string };

function markdownUrlToken(token: string) {
  let depth = 0;
  for (let index = 0; index < token.length; index += 1) {
    if (token[index] === "(") {
      depth += 1;
    } else if (token[index] === ")") {
      if (depth === 0) {
        return token.slice(0, index);
      }
      depth -= 1;
    }
  }
  return token;
}

function extractUrls(note: string) {
  const urls = new Set<string>();
  const text = note.replace(
    /https?:\/\/(?:(?!\]\()[^\s<>"`])+/giu,
    (match: string, offset: number) => {
      const token =
        note.slice(offset - 2, offset) === "]("
          ? markdownUrlToken(match)
          : match;
      try {
        urls.add(new URL(token).href);
      } catch {
        // Invalid URL text cannot supply an Event name or country.
      }
      return "\0".repeat(token.length) + match.slice(token.length);
    },
  );
  return { text, urls: [...urls] };
}

export function findInputNameCandidates(input: string, rows: NameRow[]) {
  const { text, urls } = extractUrls(input.normalize("NFC"));
  const nameText = text.toLowerCase();
  const countryText = nameText.split("");
  const candidates: NameCandidate[] = [];
  for (const row of rows) {
    let matchedName: string | undefined;
    for (const name of [row.canonicalName, ...row.aliases]) {
      const normalized = name
        .normalize("NFC")
        .toLowerCase()
        .trim()
        .replace(/\s+/gu, " ");
      if (!normalized) {
        continue;
      }
      const phrase = normalized
        .split(" ")
        .map((word) => RegExp.escape(word))
        .join("\\s+");
      const pattern = new RegExp(
        `(?<![\\p{L}\\p{M}\\p{N}])${phrase}(?![\\p{L}\\p{M}\\p{N}])`,
        "gu",
      );
      for (const match of nameText.matchAll(pattern)) {
        matchedName ??= name;
        countryText.fill("\0", match.index, match.index + match[0].length);
      }
    }
    if (matchedName !== undefined) {
      candidates.push({ eventId: row.id, matchedName });
    }
  }
  return { candidates, urls, countryText: countryText.join("") };
}

function inputCountries(text: string) {
  const codes = new Set<string>();
  const add = (code: string) => {
    const upper = code.toUpperCase();
    if (isAssignedCountryCode(upper)) {
      codes.add(upper);
    }
  };
  for (const field of text.split(/[,;\r\n]/u)) {
    const match = /^\s*([a-z]{2})\s*$/u.exec(field);
    if (match) {
      add(match[1]);
    }
  }
  for (const match of text.matchAll(
    /(?<![\p{L}\p{M}\p{N}])country\s*:\s*([a-z]{2})(?![\p{L}\p{M}\p{N}])/gu,
  )) {
    add(match[1]);
  }
  return [...codes];
}

export function findInputDuplicate(
  client: Database.Database,
  input: string,
): InputDuplicateMatch | null {
  const { candidates, urls, countryText } = findInputNameCandidates(
    input,
    readResearchNames(client),
  );
  if (!candidates.length) {
    return null;
  }
  const requestedCountries = inputCountries(countryText);
  if (requestedCountries.length > 1) {
    return null;
  }
  const country = requestedCountries[0];
  const savedCountries = readResearchCountries(
    client,
    candidates.map(({ eventId }) => eventId),
  );
  const withCountries = candidates.map((candidate) => ({
    ...candidate,
    countries: savedCountries
      .filter(({ eventId }) => eventId === candidate.eventId)
      .flatMap(({ countryCode }) =>
        countryCode === null ? [] : [countryCode],
      ),
  }));
  const remaining = withCountries.filter(
    ({ countries }) =>
      !country || countries.length !== 1 || countries[0] === country,
  );
  if (!remaining.length) {
    return null;
  }

  const supported = findUrlSupportedDuplicate(client, urls, remaining);
  if (supported !== undefined) {
    return supported;
  }
  const candidate = remaining[0];
  return remaining.length === 1 &&
    country &&
    candidate.countries.length === 1 &&
    candidate.countries[0] === country
    ? {
        eventId: candidate.eventId,
        matchedName: candidate.matchedName,
        support: { countryCode: country },
      }
    : null;
}

/** Null means a conflict; undefined leaves country support available. */
function findUrlSupportedDuplicate(
  client: Database.Database,
  urls: string[],
  candidates: (NameCandidate & { countries: string[] })[],
): InputDuplicateMatch | null | undefined {
  if (!urls.length) {
    return undefined;
  }
  const links = readResearchOfficialLinks(client).flatMap((link) => {
    try {
      return [{ ...link, url: new URL(link.url).href }];
    } catch {
      return [];
    }
  });
  let supported: InputDuplicateMatch | undefined;
  for (const url of urls) {
    const exact = links.filter((link) => link.url === url);
    if (!exact.length) {
      continue;
    }
    const named = candidates.filter((candidate) =>
      exact.some((link) => link.eventId === candidate.eventId),
    );
    if (named.length !== 1) {
      return null;
    }
    const candidate = named[0];
    if (
      candidate.countries.length > 1 ||
      (supported && supported.eventId !== candidate.eventId)
    ) {
      return null;
    }
    supported = {
      eventId: candidate.eventId,
      matchedName: candidate.matchedName,
      support: { officialUrl: url },
    };
  }
  return supported;
}
