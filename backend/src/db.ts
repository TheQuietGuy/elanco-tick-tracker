import { DatabaseSync } from 'node:sqlite';
export interface Sighting { id: string; date: string; species: string; latinName: string; location: string; region: string; lat: number; lng: number; source: 'api' | 'user'; imageUrl: string | null; notes: string | null; createdAt: string }
export function openDb(path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS sightings (
      id TEXT PRIMARY KEY, date TEXT NOT NULL, species TEXT NOT NULL, latin_name TEXT NOT NULL, location TEXT NOT NULL, region TEXT NOT NULL,
      lat REAL NOT NULL, lng REAL NOT NULL, source TEXT NOT NULL DEFAULT 'api', image_url TEXT, notes TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE INDEX IF NOT EXISTS idx_s_date ON sightings(date);
    CREATE INDEX IF NOT EXISTS idx_s_loc ON sightings(location);
    CREATE INDEX IF NOT EXISTS idx_s_species ON sightings(species);
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  return db;
}
export type Db = ReturnType<typeof openDb>;
export const rowToSighting = (r: any): Sighting => ({ id: r.id, date: r.date, species: r.species, latinName: r.latin_name, location: r.location, region: r.region, lat: r.lat, lng: r.lng, source: r.source, imageUrl: r.image_url, notes: r.notes, createdAt: r.created_at });
export function upsertSightings(db: Db, rows: Sighting[]): number {
  const stmt = db.prepare(`INSERT OR IGNORE INTO sightings (id,date,species,latin_name,location,region,lat,lng,source,image_url,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  let inserted = 0; db.exec('BEGIN');
  try { for (const s of rows) inserted += Number(stmt.run(s.id, s.date, s.species, s.latinName, s.location, s.region, s.lat, s.lng, s.source, s.imageUrl, s.notes).changes); db.exec('COMMIT'); }
  catch (e) { db.exec('ROLLBACK'); throw e; }
  return inserted;
}
export const setMeta = (db: Db, key: string, value: unknown) => db.prepare('INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, JSON.stringify(value));
export const getMeta = <T = unknown>(db: Db, key: string): T | null => { const r = db.prepare('SELECT value FROM meta WHERE key=?').get(key) as { value: string } | undefined; return r ? (JSON.parse(r.value) as T) : null; };
