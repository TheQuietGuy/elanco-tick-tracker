import type { City, Filters, Insights, Marker, Paged, SeasonMonth, Sighting, SpeciesInfo, TrendPoint } from './types';
export class ApiFailure extends Error { constructor(message: string, public status: number, public fields: { field: string; message: string }[] = []) { super(message); } }
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try { res = await fetch(path, init); } catch { throw new ApiFailure('Cannot reach the tick data service. Check your connection and try again.', 0); }
  if (!res.ok) { let body: any = null; try { body = await res.json(); } catch { /* non-JSON error */ } throw new ApiFailure(body?.error?.message ?? `Request failed (${res.status})`, res.status, body?.error?.details ?? []); }
  return res.json() as Promise<T>;
}
type Q = Partial<Filters> & { interval?: string; page?: number; limit?: number; sort?: string };
export const qs = (f: Q) => {
  const p = new URLSearchParams();
  if (f.from) p.set('from', f.from); if (f.to) p.set('to', f.to); if (f.location) p.set('location', f.location);
  if (f.species?.length) p.set('species', f.species.join(','));
  for (const k of ['interval', 'page', 'limit', 'sort'] as const) if (f[k] !== undefined) p.set(k, String(f[k]));
  const s = p.toString(); return s ? `?${s}` : '';
};
export const csvUrl = (f: Filters) => `/api/sightings.csv${qs(f)}`;
export const api = {
  markers: (f: Filters) => call<Marker[]>(`/api/map/markers${qs(f)}`),
  sightings: (f: Filters, o: { page?: number; limit?: number } = {}) => call<Paged<Sighting>>(`/api/sightings${qs({ ...f, ...o })}`),
  trends: (f: Filters, interval: 'week' | 'month' | 'year') => call<{ data: TrendPoint[] }>(`/api/insights/trends${qs({ ...f, interval })}`),
  seasonality: (f: Partial<Filters>) => call<{ months: SeasonMonth[] }>(`/api/insights/seasonality${qs(f)}`),
  byRegion: (f: Filters) => call<Insights>(`/api/insights/by-region${qs(f)}`),
  species: () => call<SpeciesInfo[]>('/api/species'),
  locations: () => call<City[]>('/api/locations'),
  report: (fd: FormData) => call<{ sighting: Sighting; warnings: string[] }>('/api/sightings', { method: 'POST', body: fd }),
  health: () => call<{ status: string; sightings: number }>('/api/health'),
};
