import { z } from "zod";
import { isAssignedCountryCode } from "./country-codes";

export const sizeEstimate = z.number().int().positive().nullish();
export const latitude = z.number().min(-90).max(90).nullish();
export const longitude = z.number().min(-180).max(180).nullish();

const localDate = z.iso.date().nullish();
export const editionScalarSchemas = {
  startsOn: localDate,
  endsOn: localDate,
  editionYear: z.number().int().min(1).max(9999).nullish(),
  countryCode: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .refine(isAssignedCountryCode, "Country code is not assigned by ISO 3166-1")
    .nullish(),
  timeZone: z
    .string()
    .max(100)
    .refine((value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, "Invalid IANA time zone")
    .nullish(),
  soldOutSourceUrl: z
    .url()
    .refine((value) => /^https?:\/\//.test(value), "Use an HTTP or HTTPS URL")
    .nullish()
    .describe(
      "Official source that confirms the whole Edition sold out. Use null to clear.",
    ),
};
