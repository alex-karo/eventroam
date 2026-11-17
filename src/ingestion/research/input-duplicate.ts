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
type Span = { start: number; end: number };

function maskSpans(text: string, spans: Span[]) {
  const characters = text.split("");
  for (const { start, end } of spans) {
    characters.fill("\0", start, end);
  }
  return characters.join("");
}

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

function inputUrls(note: string) {
  const spans: Span[] = [];
  const urls: string[] = [];
  for (const match of note.matchAll(/https?:\/\/(?:(?!\]\()[^\s<>"`])+/giu)) {
    let token = match[0];
    // Keep balanced URL parentheses and stop at the Markdown wrapper.
    if (note.slice(match.index - 2, match.index) === "](") {
      token = markdownUrlToken(token);
    }
    spans.push({ start: match.index, end: match.index + token.length });
    try {
      urls.push(new URL(token).href);
    } catch {
      // Mask invalid URL tokens too. Their path cannot supply an Event name.
    }
  }
  return { spans, urls: [...new Set(urls)] };
}

export function findInputNameCandidates(input: string, rows: NameRow[]) {
  const note = input.normalize("NFC");
  const { spans: urlSpans, urls } = inputUrls(note);
  const nameText = maskSpans(note, urlSpans).toLowerCase();
  const nameSpans: Span[] = [];
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
        nameSpans.push({
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }
    if (matchedName !== undefined) {
      candidates.push({ eventId: row.id, matchedName });
    }
  }
  return { candidates, urls, countryText: maskSpans(nameText, nameSpans) };
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
    const named = candidates.filter((candidate) =>
      exact.some((link) => link.eventId === candidate.eventId),
    );
    if (exact.length && !named.length) {
      return null;
    }
    for (const candidate of named) {
      // Several countries or different Event IDs leave the match unresolved.
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
  }
  return supported;
}
