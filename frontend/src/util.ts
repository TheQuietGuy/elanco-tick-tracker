export const SPECIES_COLOR: Record<string, string> = { 'Fox/badger tick': '#296fb7', 'Marsh tick': '#1b9aaa', 'Passerine tick': '#7b61c9', 'Southern rodent tick': '#d98a2b', 'Tree-hole tick': '#4c9f70' };
export const colorFor = (s: string | null) => (s && SPECIES_COLOR[s]) || '#296fb7';
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const EMPTY_FILTERS = { from: '', to: '', species: [] as string[], location: '' };
export const mapsDirections = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

const ML = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** Human labels for trend periods returned by the API ('2019', '2019-03', '2019-W12'). */
export function periodLabel(period: string, long = true): string {
  if (/^\d{4}$/.test(period)) return period;
  const m = /^(\d{4})-(\d{2})$/.exec(period); if (m) return long ? `${ML[+m[2] - 1]} ${m[1]}` : `${MONTHS[+m[2] - 1]} ${m[1]}`;
  const w = /^(\d{4})-W(\d{2})$/.exec(period); if (w) return long ? `Week ${+w[2]}, ${w[1]}` : `W${+w[2]} ${w[1]}`;
  return period;
}
export const MONTHS_LONG = ML;

import type { Level, Marker } from './types';
export const LEVEL: Record<Level, { label: string; color: string }> = { low: { label: 'Low', color: '#2f9e63' }, moderate: { label: 'Moderate', color: '#d98a0b' }, high: { label: 'High', color: '#d9433b' } };
/** Local activity level: places ranked by sightings in the final 12 months of data; top third High, middle third Moderate, rest Low. */
export function activityLevels(markers: Marker[] | null): Record<string, Level> {
  const out: Record<string, Level> = {}; if (!markers) return out;
  const sorted = [...markers].sort((a, b) => b.recent - a.recent || b.count - a.count); const n = sorted.length;
  sorted.forEach((m, i) => { out[m.location] = m.recent === 0 ? 'low' : i < Math.ceil(n / 3) ? 'high' : i < Math.ceil((2 * n) / 3) ? 'moderate' : 'low'; });
  return out;
}
export const greet = () => { const h = new Date().getHours(); return h < 5 ? 'Hello' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };

/** Nearest city to a point (haversine, km). */
export function nearestCity<T extends { lat: number; lng: number }>(items: T[], lat: number, lng: number): T | null {
  const rad = (d: number) => (d * Math.PI) / 180; let best: T | null = null, bd = Infinity;
  for (const c of items) { const a = Math.sin(rad(c.lat - lat) / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(c.lat)) * Math.sin(rad(c.lng - lng) / 2) ** 2; const d = 6371 * 2 * Math.asin(Math.sqrt(a)); if (d < bd) { bd = d; best = c; } }
  return best;
}
/** Ask the browser for the person's position. Nothing is sent anywhere; we only pick the closest place name. */
export function locate(): Promise<{ lat: number; lng: number }> {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('Your browser cannot share its location. Please choose a place instead.'));
    navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => rej(new Error(e.code === 1 ? 'Location is switched off for this site. Please choose a place instead.' : 'We could not work out where you are. Please choose a place instead.')), { timeout: 10000, maximumAge: 600000 });
  });
}

const STD = { species: { ...SPECIES_COLOR }, level: { low: LEVEL.low.color, moderate: LEVEL.moderate.color, high: LEVEL.high.color } };
const CB = { species: { 'Fox/badger tick': '#0072B2', 'Marsh tick': '#E69F00', 'Passerine tick': '#CC79A7', 'Southern rodent tick': '#D55E00', 'Tree-hole tick': '#009E73' }, level: { low: '#0072B2', moderate: '#E69F00', high: '#D55E00' } };
/** Switches the data colours between the standard and a colour-blind-safe (Okabe-Ito) palette. Shapes and text labels always carry the meaning too. */
export function applyPalette(colourBlind: boolean) {
  const set = colourBlind ? CB : STD; Object.assign(SPECIES_COLOR, set.species);
  (['low', 'moderate', 'high'] as Level[]).forEach((k) => { LEVEL[k].color = set.level[k]; });
}
