# Architecture notes

## Overview
```
 Elanco API ──▶ ingest (validate · normalise · dedupe) ──▶ SQLite ──▶ Express REST API ──▶ React + Leaflet
                      │ on failure: bundled snapshot                       ▲
                      └────────────────────────────────────────────────────┘ POST /api/sightings (+ image)
```

## Decisions
- **TypeScript end to end.** One language, shared mental model, and the compiler catches shape mistakes between API and UI.
- **SQLite via `node:sqlite`.** The dataset is small and read-heavy, and an embedded database needs no setup for a reviewer. Filtering, grouping and date bucketing (`strftime`) are done in SQL, so the same endpoints scale to a much larger table with the existing indexes (date, location, species). Swapping to Postgres would only touch `db.ts` and the SQL dialect.
- **Ingest once, serve locally.** The API is read at start-up and normalised into our own table rather than proxied per request. That keeps the UI fast and independent of upstream availability, and gives one place to deal with duplicates and bad rows.
- **Fail soft.** Upstream failure falls back to a snapshot and is surfaced in `/api/health` (`lastIngest.note`). Individual bad rows are counted by reason and skipped. Nothing silently disappears.
- **Zod at the boundaries.** Query strings, form bodies and raw upstream records are all validated, and errors come back as `{ error: { code, message, details[] } }` so the form can mark the exact field.
- **Uploads.** Memory storage with a 5 MB limit, MIME allow-list and a magic-byte check so a renamed text file is rejected. Files are saved under random names.
- **Leaflet + OpenStreetMap tiles** (softened with a CSS filter, attribution kept) over a bundled UK outline fallback. No API key. Marker hover uses a React overlay because Leaflet tooltips cannot escape the map pane's stacking context.
- **Charts** are hand-drawn SVG at real pixel width (ResizeObserver) so text stays crisp; trends include a per-species breakdown (`bySpecies`) for tooltips.
- **Hash routing.** Deep links such as `#/map/Manchester` work for Share without server configuration.
- **Framer Motion** for the intro and the sheet. The side panel uses a critically damped spring (no overshoot) and projects release velocity to decide whether to dismiss it. This follows the principles in the supplied Apple design skill.
- **Intro isolation.** The intro depends only on a `dataStatus` prop. It cannot block the app: it has an error boundary, a hard time cap, and a skip control.

## Trade-offs and limitations
- Location is a city, not a postcode or lat/lng, so the map shows one marker per city rather than individual points. Anything finer needs a geocoding step or a map click on the form.
- Community uploads are not moderated and the submit endpoint has no rate limit or authentication.
- Species identification is a static guide. It is not a classifier and says so in the UI.
- No end-to-end tests are committed. I checked the main flows in a browser by script but did not keep that suite.

## With more time
1. Moderation queue and rate limiting for community reports, plus image resizing and virus scanning.
2. Marker clustering and sub-city precision, with a click-on-map location picker in the form.
3. Periodic re-ingest with incremental updates and an admin view of ingest reports.
4. Playwright end-to-end tests and CI.
5. Postcode lookup, notifications for areas with rising activity, and a species photo library.
6. Server-side tile caching and a production build served by the API.

## Wireframes (text)
```
Map                                   Report
┌ topbar: logo · title · nav ───────┐ ┌ topbar ───────────────────────────┐
│ ┌ filters (glass) ───────┐ ┌side ┐│ │ Report a tick sighting            │
│ │ from · to · place      │ │panel││ │ [date] [city] [species ▾ + hint]  │
│ │ species chips · count  │ │stats││ │ [notes 0/500] [photo + preview]   │
│ └────────────────────────┘ │time ││ │ (errors summarised above, inline) │
│        map markers         │list ││ │ [Submit sighting]                 │
│ legend                     └─────┘│ └───────────────────────────────────┘
└───────────────────────────────────┘ Mobile: panel becomes a draggable bottom sheet
```
