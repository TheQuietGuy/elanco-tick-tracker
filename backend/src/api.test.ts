import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from './app.js';
import { openDb } from './db.js';
import { runIngest, normalise } from './ingest.js';

const snap = resolve(import.meta.dirname, '../data/sightings.snapshot.json');
let app: ReturnType<typeof createApp>;
beforeAll(async () => {
  const db = openDb(); const rep = await runIngest(db, { snapshotPath: snap });
  expect(rep.inserted).toBe(1000);
  app = createApp(db, { uploadDir: join(tmpdir(), 'tick-test-uploads') });
});
describe('ingest normalisation', () => {
  it('rejects incomplete and invalid records', () => {
    expect(normalise({ id: 'a', species: 'x', location: 'London' })).toMatchObject({ ok: false, reason: 'invalid date' });
    expect(normalise({ id: 'a', date: '2020-01-01T00:00:00', species: 'Marsh tick', location: 'Atlantis' })).toMatchObject({ ok: false, reason: 'unknown location' });
    expect(normalise({ date: '2020-01-01T00:00:00', species: 'Marsh tick', location: 'London' })).toMatchObject({ ok: false, reason: 'missing id' });
  });
  it('fills a missing latin name from reference data', () => {
    const r = normalise({ id: 'a', date: '2020-01-01T00:00:00', species: 'Marsh tick', location: ' london ' });
    expect(r.ok && r.row.latinName).toBe('Ixodes apronophorus'); expect(r.ok && r.row.location).toBe('London');
  });
});
describe('GET /api/sightings', () => {
  it('paginates and filters by location, species and range', async () => {
    const all = await request(app).get('/api/sightings?limit=10');
    expect(all.body.total).toBe(1000); expect(all.body.data).toHaveLength(10);
    const f = await request(app).get('/api/sightings?location=London&species=Marsh tick&from=2018-01-01&to=2020-12-31&limit=500');
    expect(f.status).toBe(200);
    for (const s of f.body.data) { expect(s.location).toBe('London'); expect(s.species).toBe('Marsh tick'); expect(s.date >= '2018-01-01' && s.date <= '2020-12-31T23:59:59').toBe(true); }
  });
  it('rejects bad input with structured errors', async () => {
    const r = await request(app).get('/api/sightings?from=yesterday');
    expect(r.status).toBe(400); expect(r.body.error.code).toBe('invalid_query');
    expect((await request(app).get('/api/sightings?from=2021-01-01&to=2020-01-01')).status).toBe(400);
    expect((await request(app).get('/api/sightings/nope')).status).toBe(404);
  });
});
describe('insights', () => {
  it('counts per region sum to total', async () => {
    const r = await request(app).get('/api/insights/by-region');
    expect(r.body.byRegion.reduce((a: number, x: any) => a + x.count, 0)).toBe(1000);
  });
  it('applies filters to every grouped insight, not just the total', async () => {
    const r = await request(app).get('/api/insights/by-region?location=Glasgow&species=Marsh tick');
    const total = r.body.total; expect(total).toBeGreaterThan(0);
    expect(r.body.byLocation).toEqual([{ location: 'Glasgow', region: 'Scotland', count: total }]);
    expect(r.body.bySpecies.map((s: any) => s.species)).toEqual(['Marsh tick']);
  });
  it('returns monthly trends and 12-month seasonality', async () => {
    const t = await request(app).get('/api/insights/trends?interval=month'); expect(t.body.data.length).toBeGreaterThan(12);
    for (const d of t.body.data.slice(0, 20)) expect(Object.values(d.bySpecies).reduce((a: number, b: any) => a + b, 0)).toBe(d.count);
    const s = await request(app).get('/api/insights/seasonality?location=Glasgow'); expect(s.body.months).toHaveLength(12);
    expect((await request(app).get('/api/insights/trends?interval=day')).status).toBe(400);
  });
});
describe('map markers', () => {
  it('keeps the "recent" window anchored to imported data, not to new user reports', async () => {
    const before = await request(app).get('/api/map/markers');
    await request(app).post('/api/sightings').field({ date: '2026-10-01', location: 'Leeds', species: 'Marsh tick' });
    const after = await request(app).get('/api/map/markers');
    const r = (b: any, l: string) => b.body.find((m: any) => m.location === l).recent;
    expect(r(after, 'Glasgow')).toBe(r(before, 'Glasgow'));
  });
});
describe('POST /api/sightings', () => {
  const good = { date: '2026-10-01', location: 'Bristol', species: 'Fox/badger tick', notes: 'On the dog after a woodland walk' };
  it('creates a sighting with an image and makes it queryable', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==', 'base64');
    const r = await request(app).post('/api/sightings').field(good).attach('image', png, { filename: 't.png', contentType: 'image/png' });
    expect(r.status).toBe(201); expect(r.body.sighting.imageUrl).toMatch(/^\/uploads\/.+\.png$/);
    expect((await request(app).get(`/api/sightings/${r.body.sighting.id}`)).status).toBe(200);
  });
  it('returns field-level validation errors', async () => {
    const r = await request(app).post('/api/sightings').field({ date: '2999-01-01', location: 'Atlantis', species: 'Marsh tick' });
    expect(r.status).toBe(422); expect(r.body.error.details.map((d: any) => d.field)).toContain('location');
  });
  it('rejects non-image uploads and spoofed image content', async () => {
    expect((await request(app).post('/api/sightings').field(good).attach('image', Buffer.from('hi'), { filename: 'a.txt', contentType: 'text/plain' })).status).toBe(415);
    expect((await request(app).post('/api/sightings').field(good).attach('image', Buffer.from('not a png'), { filename: 'a.png', contentType: 'image/png' })).status).toBe(422);
  });
  it('warns about similar existing sightings', async () => {
    const r = await request(app).post('/api/sightings').field(good);
    expect(r.status).toBe(201); expect(r.body.warnings.join(' ')).toMatch(/similar sighting/);
  });
  it('species list carries a severity rating', async () => {
    const r = await request(app).get('/api/species'); expect(r.status).toBe(200);
    expect(r.body.every((x: any) => ['low', 'moderate', 'high'].includes(x.severity))).toBe(true);
  });
  it('exports the filtered sightings as CSV', async () => {
    const r = await request(app).get('/api/sightings.csv?species=Marsh%20tick');
    expect(r.status).toBe(200); expect(r.headers['content-type']).toMatch(/text\/csv/);
    const lines = r.text.trim().split('\r\n'); expect(lines[0]).toBe('id,date,location,species');
    expect(lines.length).toBeGreaterThan(1); expect(lines.slice(1).every((l) => l.includes('Marsh tick'))).toBe(true);
    expect((await request(app).get('/api/sightings.csv?from=2020-02-01&to=2020-01-01')).status).toBe(400);
  });
});
