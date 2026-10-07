---
type: Research
title: Facebook and Instagram text access
description: Dated findings on public post text retrieval and per-item scraping costs.
status: stable
tags: [research, ingestion, sources]
---

# Facebook and Instagram text access

Checked 2026-10-05. Scope: public Facebook groups and Instagram profiles/posts, mainly captions and post text. Prices are USD list rates, not measured invoices. A **URL** and a **returned post** are different billing units.

## Direct access

Logged out, the built-in browser displayed a post and some comments in the public [Dogspotting group](https://www.facebook.com/groups/dogspotting/). `curl` returned HTTP 200 for the group, but that post's text was absent from its initial HTML; the [direct post URL](https://www.facebook.com/groups/dogspotting/posts/10166263261914467/) included the text. The public [Burning Man Instagram profile](https://www.instagram.com/burningman/) exposed its bio and post links. Opening a post from its grid prompted for login, while a [direct post URL](https://www.instagram.com/burningman/p/Dd-LvvomPh4/) displayed its caption and comments and returned the caption to `curl`. These are two spot checks, not a reliability estimate. Direct HTTP has no vendor fee, but feed discovery, pagination, blocking, and maintenance remain our costs.

## Service prices

The 20-post example assumes 20 returned posts from one group/profile URL, excluding optional comment collection and filters.

| Service | Published unit price | 20 returned posts | Fit |
| --- | ---: | ---: | --- |
| [Apify Facebook Groups Scraper](https://apify.com/apify/facebook-groups-scraper/pricing) | $0.005/post on Free + $0.001/run | $0.101 | Public group posts; Business rate $0.0026/post. |
| [Apify Instagram Scraper](https://apify.com/apify/instagram-scraper/pricing) | $0.0027/result on Free | $0.054 | Posts, reels, profiles, or comments; Business rate $0.0015/result. |
| [Bright Data Web Scraper API](https://brightdata.com/products/web-scraper) | $0.0015/successful record, pay as you go | $0.030 | Has [group-post](https://brightdata.com/products/web-scraper/facebook/groups) and [Instagram-post](https://brightdata.com/products/web-scraper/instagram/posts) collectors; published free allowance is 5,000 records/month. |
| [Firecrawl Scrape](https://www.firecrawl.dev/pricing) | 1 credit/URL; $0.0038 effective on $19/month Hobby, or $0.005/extra credit | Unknown | One URL may expose only part of a feed. Meta URL extraction was not tested through its API. |
| [Exa Contents](https://exa.ai/pricing) | $0.001/URL for one content type | Unknown | Cheap for known URLs; complete Meta feed extraction was not tested through its API. |

Apify and Bright Data bill output records, so a group/profile URL can cost many times the per-record price. Firecrawl and Exa bill URLs, but a successful request does not establish that all post text was retrieved. Firecrawl says a returned 403/404 can consume a credit. Rates and inclusions should be rechecked before use.

## Official access and assessment

Meta [removed the ordinary Facebook Groups API in April 2024](https://developers.facebook.com/docs/graph-api/changelog/version19.0/). Its [Content Library API](https://about.fb.com/news/2023/11/new-tools-to-support-independent-research/) covers public group content and Instagram business/creator content, but access is application-based for eligible researchers, with no public per-page price. The regular [Instagram API](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api) requires an authorized professional account and does not provide arbitrary consumer-account feeds.

For catalog research, first try direct HTTP for known public post URLs. Compare Apify and Bright Data on the same small set of groups/profiles for text completeness, freshness, and cost per *usable* post. Treat Firecrawl and Exa as unverified candidates until their API output is checked on those URLs. Meta [actively restricts unauthorized scraping](https://www.facebook.com/help/463983701520800), so production use also needs a terms and data-rights review.
