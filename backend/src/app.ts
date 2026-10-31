import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { Db, getMeta, rowToSighting, upsertSightings, Sighting } from './db.js';
import { CITIES, findCity } from './geo.js';
import { SPECIES, latinFor } from './species.js';

export class ApiError extends Error { constructor(public status: number, message: string, public code = 'error', public details?: unknown) { super(message); } }

const csv = (v: unknown) => (typeof v === 'string' && v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const FilterSchema = z.object({
  from: dateOnly.optional(), to: dateOnly.optional(), location: z.string().optional(), species: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(500).default(50),
  sort: z.enum(['date_desc', 'date_asc']).default('date_desc'),
});
function where(q: z.infer<typeof FilterSchema>) {
  const c: string[] = []; const p: (string | number)[] = [];
  if (q.from) { c.push('date >= ?'); p.push(`${q.from}T00:00:00`); }
  if (q.to) { c.push('date <= ?'); p.push(`${q.to}T23:59:59`); }
  const locs = csv(q.location); if (locs.length) { c.push(`location COLLATE NOCASE IN (${locs.map(() => '?').join(',')})`); p.push(...locs); }
  const sp = csv(q.species); if (sp.length) { c.push(`species COLLATE NOCASE IN (${sp.map(() => '?').join(',')})`); p.push(...sp); }
  return { sql: c.length ? `WHERE ${c.join(' AND ')}` : '', p };
}
function parseFilters(req: Request) {
  const r = FilterSchema.safeParse(req.query);
  if (!r.success) throw new ApiError(400, 'Invalid query parameters', 'invalid_query', r.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  if (r.data.from && r.data.to && r.data.from > r.data.to) throw new ApiError(400, '"from" must not be after "to"', 'invalid_range');
  return r.data;
}
const ReportSchema = z.object({
  date: z.string().min(1, 'Date is required').refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date'),
  location: z.string().min(1, 'Choose a location'), species: z.string().min(1, 'Choose a species'),
  notes: z.string().max(500, 'Notes must be 500 characters or fewer').optional(),
});
const MAGIC: Record<string, (b: Buffer) => boolean> = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8,
  'image/png': (b) => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  'image/webp': (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP',
};
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export function createApp(db: Db, opts: { uploadDir: string }) {
  mkdirSync(opts.uploadDir, { recursive: true });
  const app = express();
  app.use(cors()); app.use(express.json({ limit: '100kb' }));
  app.use('/uploads', express.static(opts.uploadDir, { maxAge: '7d' }));
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (_r, f, cb) => (MAGIC[f.mimetype] ? cb(null, true) : cb(new ApiError(415, 'Images must be JPEG, PNG or WebP', 'unsupported_image'))) });

  app.get('/api/health', (_req, res) => { res.json({ status: 'ok', sightings: (db.prepare('SELECT COUNT(*) n FROM sightings').get() as any).n, lastIngest: getMeta(db, 'lastIngest') }); });
  app.get('/api/locations', (_req, res) => res.json(CITIES));
  app.get('/api/species', (_req, res) => {
    const m = new Map((db.prepare('SELECT species, COUNT(*) n FROM sightings GROUP BY species').all() as any[]).map((c) => [c.species, c.n]));
    res.json(SPECIES.map((s) => ({ ...s, sightings: m.get(s.species) ?? 0 })));
  });
  app.get('/api/sightings', (req, res) => {
    const q = parseFilters(req); const w = where(q);
    const total = (db.prepare(`SELECT COUNT(*) n FROM sightings ${w.sql}`).get(...w.p) as any).n;
    const rows = db.prepare(`SELECT * FROM sightings ${w.sql} ORDER BY date ${q.sort === 'date_asc' ? 'ASC' : 'DESC'}, id LIMIT ? OFFSET ?`).all(...w.p, q.limit, (q.page - 1) * q.limit);
    res.json({ total, page: q.page, limit: q.limit, pages: Math.max(1, Math.ceil(total / q.limit)), data: rows.map(rowToSighting) });
  });
  app.get('/api/sightings.csv', (req, res) => {
    const q = parseFilters(req); const w = where(q);
    const rows = (db.prepare(`SELECT * FROM sightings ${w.sql} ORDER BY date DESC, id`).all(...w.p) as any[]).map(rowToSighting) as any[];
    // Cells starting with = + - @ are prefixed so spreadsheets never run them as formulas.
    const cell = (v: unknown) => { let t = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`; return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const cols = ['id', 'date', 'location', 'species'];
    const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n') + '\r\n';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', 'attachment; filename="tick-sightings.csv"'); res.send(csv);
  });
  app.get('/api/sightings/:id', (req, res) => {
    const r = db.prepare('SELECT * FROM sightings WHERE id = ?').get(req.params.id);
    if (!r) throw new ApiError(404, 'Sighting not found', 'not_found');
    res.json(rowToSighting(r));
  });
  app.post('/api/sightings', upload.single('image'), (req, res) => {
    const parsed = ReportSchema.safeParse(req.body ?? {});
    const errors: { field: string; message: string }[] = parsed.success ? [] : parsed.error.issues.map((i) => ({ field: String(i.path[0]), message: i.message }));
    const city = findCity(String(req.body?.location ?? ''));
    if (parsed.success && !city) errors.push({ field: 'location', message: 'We only track the listed UK cities' });
    const sp = SPECIES.find((s) => s.species.toLowerCase() === String(req.body?.species ?? '').toLowerCase());
    if (parsed.success && !sp) errors.push({ field: 'species', message: 'Choose one of the listed species' });
    const when = parsed.success ? new Date(parsed.data.date) : null;
    if (when && when.getTime() > Date.now()) errors.push({ field: 'date', message: 'Date cannot be in the future' });
    if (req.file && !MAGIC[req.file.mimetype](req.file.buffer)) errors.push({ field: 'image', message: 'File content does not match an image' });
    if (errors.length || !parsed.success || !city || !sp || !when) throw new ApiError(422, 'Please fix the highlighted fields', 'validation_failed', errors);
    const warnings: string[] = [];
    if (Date.now() - when.getTime() > 5 * 365 * 864e5) warnings.push('This sighting is more than five years old, so it will not affect recent-activity views.');
    const day = when.toISOString().slice(0, 10);
    const dup = db.prepare(`SELECT COUNT(*) n FROM sightings WHERE location=? AND species=? AND date >= ? AND date <= ?`).get(city.name, sp.species, `${day}T00:00:00`, `${day}T23:59:59`) as any;
    if (dup.n > 0) warnings.push(`${dup.n} similar sighting(s) already exist for ${city.name} on this date. Yours was still saved.`);
    let imageUrl: string | null = null;
    if (req.file) { const name = `${randomUUID()}.${EXT[req.file.mimetype]}`; writeFileSync(join(opts.uploadDir, name), req.file.buffer); imageUrl = `/uploads/${name}`; }
    const s: Sighting = { id: `user-${randomUUID()}`, date: when.toISOString().slice(0, 19), species: sp.species, latinName: latinFor(sp.species)!, location: city.name, region: city.region, lat: city.lat, lng: city.lng, source: 'user', imageUrl, notes: parsed.data.notes?.trim() || null, createdAt: new Date().toISOString() };
    upsertSightings(db, [s]); res.status(201).json({ sighting: s, warnings });
  });
  app.get('/api/map/markers', (req, res) => {
    const q = parseFilters(req); const w = where(q);
    const rows = db.prepare(`SELECT location, region, lat, lng, COUNT(*) count, MAX(date) lastSeen,
      SUM(CASE WHEN date >= date((SELECT MAX(date) FROM sightings WHERE source = 'api'), '-365 days') THEN 1 ELSE 0 END) recent FROM sightings ${w.sql} GROUP BY location`).all(...w.p) as any[];
    const top = db.prepare(`SELECT location, species, COUNT(*) n FROM sightings ${w.sql} GROUP BY location, species`).all(...w.p) as any[];
    const best = new Map<string, any>(); for (const t of top) { const b = best.get(t.location); if (!b || t.n > b.n) best.set(t.location, t); }
    res.json(rows.map((r) => ({ ...r, topSpecies: best.get(r.location)?.species ?? null })));
  });
  app.get('/api/insights/by-region', (req, res) => {
    const q = parseFilters(req); const w = where(q);
    res.json({ total: (db.prepare(`SELECT COUNT(*) n FROM sightings ${w.sql}`).get(...w.p) as any).n,
      byRegion: db.prepare(`SELECT region, COUNT(*) count FROM sightings ${w.sql} GROUP BY region ORDER BY count DESC`).all(...w.p),
      byLocation: db.prepare(`SELECT location, region, COUNT(*) count FROM sightings ${w.sql} GROUP BY location ORDER BY count DESC`).all(...w.p),
      bySpecies: db.prepare(`SELECT species, latin_name latinName, COUNT(*) count FROM sightings ${w.sql} GROUP BY species ORDER BY count DESC`).all(...w.p) });
  });
  app.get('/api/insights/trends', (req, res) => {
    const q = parseFilters(req); const w = where(q);
    const interval = z.enum(['week', 'month', 'year']).default('month').safeParse(req.query.interval);
    if (!interval.success) throw new ApiError(400, 'interval must be week, month or year', 'invalid_query');
    const fmt = { week: '%Y-W%W', month: '%Y-%m', year: '%Y' }[interval.data];
    const rows = db.prepare(`SELECT strftime('${fmt}', date) period, MIN(date) start, COUNT(*) count FROM sightings ${w.sql} GROUP BY period ORDER BY period`).all(...w.p) as any[];
    const split = db.prepare(`SELECT strftime('${fmt}', date) period, species, COUNT(*) n FROM sightings ${w.sql} GROUP BY period, species`).all(...w.p) as any[];
    const by = new Map<string, Record<string, number>>();
    for (const r of split) (by.get(r.period) ?? by.set(r.period, {}).get(r.period)!)[r.species] = r.n;
    res.json({ interval: interval.data, data: rows.map((r) => ({ ...r, bySpecies: by.get(r.period) ?? {} })) });
  });
  app.get('/api/insights/seasonality', (req, res) => {
    const q = parseFilters(req); const w = where(q);
    const rows = db.prepare(`SELECT CAST(strftime('%m', date) AS INTEGER) month, species, COUNT(*) count FROM sightings ${w.sql} GROUP BY month, species`).all(...w.p) as any[];
    const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: 0, bySpecies: {} as Record<string, number> }));
    for (const r of rows) { months[r.month - 1].total += r.count; months[r.month - 1].bySpecies[r.species] = r.count; }
    res.json({ months });
  });
  app.use('/api', (_req, _res, next) => next(new ApiError(404, 'Unknown API route', 'not_found')));
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ApiError) return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    if (err instanceof multer.MulterError) return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: { code: err.code, message: err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller' : err.message } });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'bad_json', message: 'Request body is not valid JSON' } });
    console.error(err); res.status(500).json({ error: { code: 'internal', message: 'Something went wrong on our side' } });
  });
  return app;
}
