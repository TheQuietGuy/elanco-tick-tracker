import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { findCity } from './geo.js';
import { latinFor } from './species.js';
import { Db, Sighting, upsertSightings, setMeta } from './db.js';

const RawSchema = z.object({ id: z.string().optional(), date: z.string().optional(), species: z.string().optional(), latinName: z.string().optional(), location: z.string().optional() }).passthrough();
export interface IngestReport { source: 'live-api' | 'snapshot'; fetched: number; inserted: number; duplicates: number; rejected: { reason: string; count: number }[]; at: string; note?: string }

/** Normalise one raw record or return a rejection reason. */
export function normalise(raw: unknown): { ok: true; row: Sighting } | { ok: false; reason: string } {
  const p = RawSchema.safeParse(raw); if (!p.success) return { ok: false, reason: 'malformed record' };
  const r = p.data;
  const id = r.id?.trim(); if (!id) return { ok: false, reason: 'missing id' };
  const species = r.species?.trim(); if (!species) return { ok: false, reason: 'missing species' };
  const loc = r.location?.trim(); if (!loc) return { ok: false, reason: 'missing location' };
  const city = findCity(loc); if (!city) return { ok: false, reason: 'unknown location' };
  const d = r.date ? new Date(r.date) : null;
  if (!d || Number.isNaN(d.getTime())) return { ok: false, reason: 'invalid date' };
  if (d.getTime() > Date.now() + 864e5) return { ok: false, reason: 'date in the future' };
  return { ok: true, row: { id, date: d.toISOString().slice(0, 19), species, latinName: r.latinName?.trim() || latinFor(species) || 'Unknown', location: city.name, region: city.region, lat: city.lat, lng: city.lng, source: 'api', imageUrl: null, notes: null, createdAt: new Date().toISOString() } };
}

async function fetchLive(url: string, apiPath: string, timeoutMs = 8000): Promise<unknown[]> {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(new URL(apiPath, url), { signal: ctl.signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`Upstream responded ${res.status}`);
    const body: any = await res.json(); const list = Array.isArray(body) ? body : body.sightings ?? body.data;
    if (!Array.isArray(list)) throw new Error('Upstream payload had no sighting list');
    return list;
  } finally { clearTimeout(t); }
}

export async function runIngest(db: Db, opts: { snapshotPath: string; liveUrl?: string; livePath?: string }): Promise<IngestReport> {
  let raw: unknown[]; let source: IngestReport['source'] = 'live-api'; let note: string | undefined;
  try { if (!opts.liveUrl) throw new Error('No ELANCO_API_URL configured'); raw = await fetchLive(opts.liveUrl, opts.livePath ?? '/'); }
  catch (e) { source = 'snapshot'; note = `Live API unavailable (${(e as Error).message}); used bundled snapshot.`; raw = JSON.parse(await readFile(opts.snapshotPath, 'utf8')); }
  const seen = new Set<string>(); const rejected = new Map<string, number>(); const good: Sighting[] = []; let duplicates = 0;
  for (const item of raw) {
    const n = normalise(item);
    if (!n.ok) { rejected.set(n.reason, (rejected.get(n.reason) ?? 0) + 1); continue; }
    if (seen.has(n.row.id)) { duplicates++; continue; }
    seen.add(n.row.id); good.push(n.row);
  }
  const inserted = upsertSightings(db, good);
  const report: IngestReport = { source, fetched: raw.length, inserted, duplicates: duplicates + (good.length - inserted), rejected: [...rejected].map(([reason, count]) => ({ reason, count })), at: new Date().toISOString(), note };
  setMeta(db, 'lastIngest', report); return report;
}
