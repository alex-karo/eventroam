import { z } from "zod";

const origin = z.url().transform((s) => new URL(s).origin);
export function siteOrigins(
  values: Record<string, string | undefined> = process.env,
) {
  return {
    apex: origin.parse(values.PUBLIC_APEX_ORIGIN ?? "http://localhost:3000"),
    festivals: origin.parse(
      values.PUBLIC_FESTIVALS_ORIGIN ?? "http://festivals.localhost:3000",
    ),
  };
}
export type Site = "apex" | "festivals";
export function siteForHost(
  host: string | null,
  origins = siteOrigins(),
): Site | null {
  if (!host) {
    return null;
  }
  const normalized = host.toLowerCase();
  if (normalized === new URL(origins.apex).host) {
    return "apex";
  }
  if (normalized === new URL(origins.festivals).host) {
    return "festivals";
  }
  return null;
}
export const eventPath = (slug: string) => `/events/${slug}`;
export const editionPath = (slug: string, key: string) =>
  `${eventPath(slug)}/${key}`;
