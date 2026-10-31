# Video walkthrough script (aim for 6–8 minutes, hard limit 10)

Record with QuickTime (File > New Screen Recording) or Loom, with `npm run dev` running. Say your name at the start.

1. **0:00 Intro (20s).** "I'm Sarhan Alam Khan. This is my UK Tick Surveillance MVP for the Elanco task."
2. **0:20 Launch and intro (45s).** Open `localhost:5173` in a private window so the full intro shows. Point out the five stages, the Skip button, sound off by default. Mention READY only appears once the API really responds.
3. **1:05 Map (90s).** Marker size and colour, dark ring legend. Toggle two species chips and a date range and show the count change. Click Manchester: timeline (yearly/monthly), species mix, expand a sighting, Get directions, Share.
4. **2:35 Insights (45s).** Region and place counts, weekly/monthly/yearly trend.
5. **3:20 Learn (60s).** Identification guide, seasonal chart for two cities, prevention tips.
6. **4:20 Report (75s).** Submit empty to show validation. Fill it in with a photo, submit, show the success message and the new sighting on the map.
7. **5:35 Backend (90s).** Open `backend/src/ingest.ts` (validation, dedupe, fallback), `app.ts` (filters, aggregates, upload checks). Run `npm test`. Show `/api/health`.
8. **7:05 Decisions and next steps (60s).** SQLite and ingest-once, fail-soft error handling, what you would improve (moderation, clustering, e2e tests).
9. **8:05 Close.** Mention the README and docs.

Upload as an unlisted YouTube video (or add the file to the repo) and paste the link into the README.
