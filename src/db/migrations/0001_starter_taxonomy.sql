-- Curated starter vocabulary; preserve existing natural-key identities and metadata.
WITH seed(facet, slug, name) AS (VALUES
  ('event_type', 'festival', 'Festival'),
  ('event_type', 'gathering', 'Participatory gathering'),
  ('format', 'openair', 'Open-air'),
  ('format', 'mixed-indoor-outdoor', 'Mixed indoor/outdoor'),
  ('format', 'indoor', 'Indoor'),
  ('topic', 'music', 'Music'),
  ('topic', 'arts', 'Arts'),
  ('topic', 'reenactment', 'Historical reenactment'),
  ('topic', 'wellness', 'Wellness'),
  ('topic', 'moto', 'Motorcycling'),
  ('topic', 'snow-sports', 'Snow sports'),
  ('topic', 'surfing', 'Surfing'),
  ('topic', 'food-and-drink', 'Food & drink'),
  ('topic', 'outdoor', 'Outdoor activities'),
  ('genre', 'electronic', 'Electronic'),
  ('genre', 'rock', 'Rock'),
  ('genre', 'metal', 'Metal'),
  ('genre', 'punk', 'Punk'),
  ('genre', 'pop', 'Pop'),
  ('genre', 'hip-hop-rap', 'Hip-hop / rap'),
  ('genre', 'folk', 'Folk'),
  ('genre', 'jazz', 'Jazz'),
  ('genre', 'blues', 'Blues'),
  ('genre', 'soul-rnb', 'Soul / R&B'),
  ('genre', 'reggae', 'Reggae'),
  ('genre', 'country', 'Country'),
  ('genre', 'classical', 'Classical'),
  ('genre', 'ambient', 'Ambient'),
  ('genre', 'experimental', 'Experimental'),
  ('genre', 'funk', 'Funk'),
  ('genre', 'disco', 'Disco'),
  ('genre', 'ska', 'Ska'),
  ('genre', 'dub', 'Dub'),
  ('genre', 'dancehall', 'Dancehall'),
  ('genre', 'afrobeat', 'Afrobeat'),
  ('genre', 'afrobeats', 'Afrobeats'),
  ('culture', 'burning-like', 'Burning-like')
)
INSERT INTO taxonomy_terms (id, facet, slug, name, parent_id)
SELECT 'catalog:term:' || seed.facet || ':' || seed.slug,
       seed.facet, seed.slug, seed.name, NULL
FROM seed
WHERE true
ON CONFLICT (facet, slug) DO NOTHING;
--> statement-breakpoint
WITH seed(facet, slug, name, parent_slug) AS (VALUES
  ('genre', 'house', 'House', 'electronic'),
  ('genre', 'techno', 'Techno', 'electronic'),
  ('genre', 'trance', 'Trance', 'electronic'),
  ('genre', 'psytrance', 'Psytrance', 'electronic'),
  ('genre', 'drum-and-bass', 'Drum & bass', 'electronic'),
  ('genre', 'downtempo', 'Downtempo', 'electronic'),
  ('genre', 'breakbeat', 'Breakbeat', 'electronic'),
  ('genre', 'dubstep', 'Dubstep', 'electronic'),
  ('genre', 'uk-garage', 'UK Garage', 'electronic'),
  ('genre', 'jungle', 'Jungle', 'electronic'),
  ('genre', 'hardstyle', 'Hardstyle', 'electronic'),
  ('genre', 'alternative-rock', 'Alternative Rock', 'rock'),
  ('genre', 'indie-rock', 'Indie Rock', 'rock'),
  ('genre', 'psychedelic-rock', 'Psychedelic Rock', 'rock'),
  ('genre', 'hard-rock', 'Hard Rock', 'rock'),
  ('genre', 'heavy-metal', 'Heavy Metal', 'metal'),
  ('genre', 'thrash-metal', 'Thrash Metal', 'metal'),
  ('genre', 'death-metal', 'Death Metal', 'metal'),
  ('genre', 'black-metal', 'Black Metal', 'metal'),
  ('genre', 'doom-metal', 'Doom Metal', 'metal'),
  ('genre', 'hardcore-punk', 'Hardcore Punk', 'punk')
)
INSERT INTO taxonomy_terms (id, facet, slug, name, parent_id)
SELECT 'catalog:term:' || seed.facet || ':' || seed.slug,
       seed.facet, seed.slug, seed.name, parent.id
FROM seed
JOIN taxonomy_terms AS parent
  ON parent.facet = seed.facet AND parent.slug = seed.parent_slug
WHERE true
ON CONFLICT (facet, slug) DO NOTHING;
--> statement-breakpoint
WITH seed(facet, slug, name, parent_slug) AS (VALUES
  ('genre', 'deep-house', 'Deep House', 'house'),
  ('genre', 'tech-house', 'Tech House', 'house'),
  ('genre', 'progressive-house', 'Progressive House', 'house'),
  ('genre', 'afro-house', 'Afro House', 'house'),
  ('genre', 'organic-house', 'Organic House', 'house'),
  ('genre', 'minimal-techno', 'Minimal Techno', 'techno'),
  ('genre', 'hard-techno', 'Hard Techno', 'techno'),
  ('genre', 'melodic-techno', 'Melodic Techno', 'techno'),
  ('genre', 'goa-trance', 'Goa Trance', 'psytrance'),
  ('genre', 'progressive-psytrance', 'Progressive Psytrance', 'psytrance'),
  ('genre', 'darkpsy', 'Darkpsy', 'psytrance'),
  ('genre', 'forest-psytrance', 'Forest Psytrance', 'psytrance'),
  ('genre', 'hi-tech', 'Hi-Tech', 'psytrance')
)
INSERT INTO taxonomy_terms (id, facet, slug, name, parent_id)
SELECT 'catalog:term:' || seed.facet || ':' || seed.slug,
       seed.facet, seed.slug, seed.name, parent.id
FROM seed
JOIN taxonomy_terms AS parent
  ON parent.facet = seed.facet AND parent.slug = seed.parent_slug
WHERE true
ON CONFLICT (facet, slug) DO NOTHING;
