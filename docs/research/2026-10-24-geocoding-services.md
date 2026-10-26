---
type: Research
title: Geocoding service research
description: Dated service and community findings for location lookup during catalog ingestion.
status: stable
tags: [research, ingestion, geocoding]
---

# Geocoding service research

Researched 2026-10-24. This document records provider and community findings. No provider has been selected, and no provider API was tested with Eventroam locations. Prices, quotas, and terms can change.

## Project need

Convert an address or a venue name into coordinates during owner-run ingestion. Store accepted coordinates in our database. Provider-hosted record storage is not required. Permission to retain and reuse the returned coordinates is required, even when all records stay in our database.

Eventroam covers festivals and burning-like gatherings worldwide. Inputs can include rural venues, fields, campsites, and incomplete addresses. Address lookup and venue-name search must be assessed separately. A nearby town is not an exact match for a festival site.

The [runtime decision](../decisions/002-runtime-and-tooling.md) selects Mapbox for map display but leaves the ingestion geocoder open. The [catalog records spec](../../openspec/specs/catalog/records/spec.md) requires coordinates and precision to agree. A provider choice must preserve these rules.

## Provider findings

| Provider | Findings relevant to Eventroam | Open questions |
| --- | --- | --- |
| **Geoapify** | The [free plan](https://www.geoapify.com/pricing/) has 3,000 credits/day and up to 5 requests/second. A simple geocoding request normally costs one credit. Commercial production use is allowed with the required attribution. The [geocoding FAQ](https://www.geoapify.com/geocoding-api/) allows stored results with data-source attribution. | Venue-name coverage, rural accuracy, and the attribution needed when stored coordinates appear on our map. |
| **LocationIQ** | The [free plan](https://locationiq.com/pricing) has 5,000 requests/day, 2 requests/second, and 60 requests/minute. Commercial use requires a prominent link. The FAQ permits response data to be kept forever but separately limits free request-response caching to 48 hours. | Exact venue accuracy. Preserve the distinction between stored catalog data and a reusable request-response cache. |
| **Amazon Location** | The [Geocode API](https://docs.aws.amazon.com/location/latest/APIReference/API_geoplaces_Geocode.html) provides an explicit `IntendedUse: "Storage"` setting for retained results, at a higher rate than `SingleUse`. | Test address lookup and venue search with the correct operations. Community evidence does not establish a quality advantage. |
| **Google Maps Platform** | Community reports make Google a useful candidate for venue-name search. Its [EEA terms](https://cloud.google.com/terms/maps-platform/eea/maps-service-terms) and [non-EEA terms](https://cloud.google.com/maps-platform/terms/maps-service-terms) have specific storage and map-use rules. | Confirm that the applicable terms permit a shared catalog with retained coordinates and Mapbox display. Do not assume that a general caching allowance permits this use. |
| **HERE** | Community reports suggest it is worth testing for rural locations. | Confirm the applicable permanent-storage offer, price, attribution, and display rights before selection. |
| **Esri ArcGIS** | The [geocoding API](https://developers.arcgis.com/rest/geocode/find-address-candidates/) has an explicit `forStorage=true` mode for retained results. This mode requires a valid token and uses the stored-geocoding offer. | Test complete addresses, incomplete addresses, and venue names separately. |
| **Azure Maps** | The [Microsoft Product Terms](https://www.microsoft.com/licensing/terms/productoffering/MicrosoftAzure/MCA) include Azure Maps rules for result storage and use. | Confirm that retention, shared catalog use, and Mapbox display are all permitted together. This research does not establish that fit. |
| **Mapbox** | It is already the selected map provider. Its [Geocoding API](https://docs.mapbox.com/api/search/geocoding/) distinguishes temporary and permanent results. Version 6 does not return points of interest; venue search needs a separate API. | Assess venue search and its storage rights separately from permanent address geocoding. Map display alone does not make it the best ingestion provider. |

Other candidates discussed were OpenCage, Geocode Earth, TomTom, and self-hosted Photon or Pelias. They remain alternatives, with no measured Eventroam results. Self-hosting would add data updates and service operation to our scope.

## Community evidence

These are reports from users, not a representative survey. Several discussion threads also contain replies from provider staff. Their advice can explain a product, but it is not independent evidence of quality. Old prices and terms in comments must not be treated as current offers.

| Source | Report | Limit of the evidence |
| --- | --- | --- |
| [Reddit: missing places in Mapbox search](https://www.reddit.com/r/mapbox/comments/17ie09u/geocoding_is_missing_place_that_are_visible_on/) — thread started in 2023, with later replies | Users could see a venue on the map but could not find it by name. One developer returned to Google after a migration. | Useful examples of venue-search failures. Different API versions and search products can behave differently. |
| [Hacker News: geocoding comparison](https://news.ycombinator.com/item?id=43770446) — April 2025 | A LocationIQ customer was happy with the service and a negotiated rate limit, but reported weaker results for street addresses than Google. Another participant praised Geoapify's React components. | Single-user accounts. Ease of integration does not establish coordinate accuracy. Several other replies are from providers. |
| [Reddit: Location API](https://www.reddit.com/r/learnjavascript/comments/165pzm6/) — August 2023 | A developer recommended Geoapify after trying several services for a mapping app. | No input data, measured errors, or named comparison set. |
| [Reddit: free geocoding services](https://www.reddit.com/r/geospatial/comments/1ttciaq/free_online_geolocation_services/) — June 2026 | A user reported many outliers after processing several thousand addresses with Geoapify. | No sample data or measured error rate. This does not identify whether input quality or provider coverage caused the errors. |
| [GIS Stack Exchange: API comparison](https://gis.stackexchange.com/questions/62374/geocoding-apis-comparison) — BetterMile answer, January 2023 | A company representative described tests on millions of delivery addresses, mainly in Europe. The report noted good HERE rural data and more successful Google matches. | The author also promoted their own product. The data and method are not sufficient to reproduce the reported ranking. Delivery addresses differ from festival sites. |
| [Reddit: Amazon Location data providers](https://www.reddit.com/r/aws/comments/1fn46uz/) — September 2024 | A developer asked which provider to use for Latin America. Replies pointed to country-specific coverage. | No measured quality comparison. The older provider-selection model must not be assumed to describe every current AWS API. |

The evidence does not show that Geoapify is more accurate than LocationIQ. It also does not establish Amazon Location as a quality winner. Google has useful venue-search reports, but those reports do not settle the terms question for our catalog.

## Published practical comparison

[PickYourPlace's comparison](https://www.pickyourplace.app/blog/geocoding), published 2024-10-31, tested 1,000 Calgary addresses. It compared Mapbox, Google, Esri, and HERE with incomplete input, complete input, and input with spelling changes. Esri and HERE were accessed through Amazon Location. The author had previously worked on the Amazon Location team.

For complete addresses, the reported median coordinate errors were:

| Provider | Median error |
| --- | ---: |
| Esri | 6.40 m |
| Google | 7.08 m |
| Mapbox | 15.60 m |
| HERE | 16.79 m |

Results changed substantially when city, province, and country were absent. The test supports adding known location context and measuring distance from a trusted reference. It does not establish a worldwide ranking or predict performance on festival venue names. A returned result and a correct result are separate measures.
