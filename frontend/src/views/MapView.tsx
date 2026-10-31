import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, useReducedMotion } from 'framer-motion';
import { CircleMarker, MapContainer, Pane, Polygon, TileLayer, useMap, useMapEvents, ZoomControl } from 'react-leaflet';
import type { PathOptions } from 'leaflet';
import { GB, NI } from '../intro/ukOutline';
import 'leaflet/dist/leaflet.css';
import { api, ApiFailure } from '../api';
import type { City, Filters, Level, Marker } from '../types';
import { LevelBadge } from '../components/Level';
import { LocationSelect } from '../components/Select';
import SightingPanel from './SightingPanel';
import { colorFor, fmtDate, greet, LEVEL, locate, nearestCity, SPECIES_COLOR, todayISO } from '../util';

// Fallback outline sits below the tiles, so the map is never blank if the tile server is slow or unreachable.
const toLatLng = (pts: [number, number][]) => pts.map(([lo, la]) => [la, lo] as [number, number]);
const UK_BOUNDS: [[number, number], [number, number]] = [[49.7, -7.6], [59.0, 2.4]];

function FlyTo({ m }: { m: Marker | null }) {
  const map = useMap();
  useEffect(() => { if (m) map.flyTo([m.lat, m.lng - (window.innerWidth > 720 ? 0.9 : 0)], Math.max(map.getZoom(), 7), { duration: 0.6 }); }, [m?.location]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
/** Place names drawn as real buttons next to each circle. Greedy placement avoids overlaps; hidden ones stay reachable by keyboard. */
function Labels({ markers, selected, onPick, levels, hoverSet }: { markers: Marker[]; selected: string; onPick: (l: string) => void; levels: Record<string, Level>; hoverSet: (l: string | null) => void }) {
  const map = useMap(); const [, tick] = useState(0);
  useMapEvents({ move: () => tick((n) => n + 1), zoom: () => tick((n) => n + 1), resize: () => tick((n) => n + 1) });
  const size = map.getSize(); const placed: { x: number; y: number; w: number; h: number }[] = []; const out: { m: Marker; x: number; y: number; show: boolean }[] = [];
  const pts = markers.map((m) => ({ m, p: map.latLngToContainerPoint([m.lat, m.lng]), r: 7 + Math.sqrt(m.count) * 1.7 }));
  const circles = pts.map(({ p, r }) => ({ x: p.x - r, y: p.y - r, w: 2 * r, h: 2 * r }));
  const hit = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => a.x < b.x + b.w + 3 && a.x + a.w + 3 > b.x && a.y < b.y + b.h + 2 && a.y + a.h + 2 > b.y;
  [...pts].sort((a, b) => (b.m.location === selected ? 1 : 0) - (a.m.location === selected ? 1 : 0) || b.m.count - a.m.count).forEach(({ m, p, r }) => {
    const sel = m.location === selected; const w = m.location.length * 7 + 26 + (sel ? 34 : 0), h = sel ? 28 : 24;
    const cands = [[p.x + r + 6, p.y - h / 2], [p.x - r - 6 - w, p.y - h / 2], [p.x - w / 2, p.y - r - 6 - h], [p.x - w / 2, p.y + r + 6]];
    const ok = cands.find(([x, y]) => x > 4 && y > 70 && x + w < size.x - 4 && y + h < size.y - 4 && !placed.some((b) => hit({ x, y, w, h }, b)) && !circles.some((c, i) => pts[i].m !== m && hit({ x, y, w, h }, c)));
    const [x, y] = ok ?? cands[0]; if (ok || sel) placed.push({ x, y, w, h }); out.push({ m, x, y, show: !!ok || sel });
  });
  return (
    <div className="labels" role="group" aria-label="Places on the map">{out.sort((a, b) => a.m.location.localeCompare(b.m.location)).map(({ m, x, y, show }) => (
      <button key={m.location} type="button" className={`city-label${m.location === selected ? ' on' : ''}${show ? '' : ' quiet'}`} style={{ left: x, top: y }} aria-pressed={m.location === selected}
        aria-label={`${m.location}, ${m.count} sightings, ${LEVEL[levels[m.location] ?? 'low'].label.toLowerCase()} recent activity. ${m.location === selected ? 'Selected.' : 'Open details.'}`}
        onClick={() => onPick(m.location === selected ? '' : m.location)} onPointerEnter={() => hoverSet(m.location)} onPointerLeave={() => hoverSet(null)}>
        {m.location}{m.location === selected && <span className="ct">{m.count}</span>}</button>))}</div>);
}
const useMobile = () => { const [m, setM] = useState(() => matchMedia('(max-width: 720px)').matches); useEffect(() => { const q = matchMedia('(max-width: 720px)'); const h = () => setM(q.matches); q.addEventListener('change', h); return () => q.removeEventListener('change', h); }, []); return m; };

interface Props { levels: Record<string, Level>; onInsights: (l: string) => void; onLearn: (sp: string) => void; initial: Marker[] | null; filters: Filters; setFilters: (f: Filters) => void; cities: City[]; selected: string; setSelected: (l: string) => void; onReport: (l: string) => void }

export default function MapView({ levels, onInsights, onLearn, initial, filters, setFilters, cities, selected, setSelected, onReport }: Props) {
  const [markers, setMarkers] = useState<Marker[] | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<{ m: Marker; x: number; y: number; r: number } | null>(null);
  const mobile = useMobile(); const reduced = !!useReducedMotion();
  useEffect(() => {
    let live = true; setError(null);
    api.markers(filters).then((m) => live && setMarkers(m)).catch((e: ApiFailure) => live && setError(e.message));
    return () => { live = false; };
  }, [filters.from, filters.to, filters.species.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const sel = useMemo(() => markers?.find((m) => m.location === selected) ?? null, [markers, selected]);
  const total = markers?.reduce((a, m) => a + m.count, 0) ?? 0;
  const [near, setNear] = useState(''); const [fOpen, setFOpen] = useState(false);
  const findMe = () => { setNear('Finding your nearest place…'); locate().then((p) => { const c = nearestCity(cities, p.lat, p.lng); if (c) { setSelected(c.name); setNear(`Your nearest place is ${c.name}.`); } }).catch((e: Error) => setNear(e.message)); };
  const toggle = (s: string) => setFilters({ ...filters, species: filters.species.includes(s) ? filters.species.filter((x) => x !== s) : [...filters.species, s] });
  const badRange = !!filters.from && !!filters.to && filters.from > filters.to;
  return (
    <div className="mapwrap">
      <div className="map">
        <MapContainer bounds={UK_BOUNDS} boundsOptions={{ padding: [24, 24] }} minZoom={5} maxZoom={11} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <Pane name="fallback" style={{ zIndex: 150 }}>
            {[GB, NI].map((r, i) => <Polygon key={i} positions={toLatLng(r)} interactive={false} className="uk-shape" pathOptions={{ color: '#b9c9dc', weight: 1.5, fillColor: '#f4f8fc', fillOpacity: 1 }} />)}
          </Pane>
          <TileLayer className="tiles-soft" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
          {markers?.map((m) => { const lv = LEVEL[levels[m.location] ?? 'low'];
            const base = (on: boolean): PathOptions => ({ fillColor: colorFor(m.topSpecies), fillOpacity: on || selected === m.location ? 0.95 : 0.72, color: lv.color, weight: on ? 5 : 3.5 });
            return (
            <CircleMarker key={m.location} center={[m.lat, m.lng]} radius={7 + Math.sqrt(m.count) * 1.7} pathOptions={base(false)}
              eventHandlers={{ click: () => setSelected(m.location), mouseover: (e) => { e.target.setStyle(base(true)); setHover({ m, x: e.containerPoint.x, y: e.containerPoint.y, r: 7 + Math.sqrt(m.count) * 1.7 }); }, mouseout: (e) => { e.target.setStyle(base(false)); setHover(null); } }}>
            </CircleMarker>); })}
          {markers && <Labels markers={markers} selected={selected} onPick={setSelected} levels={levels} hoverSet={() => {}} />}
          {!mobile && <ZoomControl position="bottomright" />}
          {sel && <CircleMarker key={`halo-${sel.location}`} center={[sel.lat, sel.lng]} radius={7 + Math.sqrt(sel.count) * 1.7 + 8} interactive={false} className="sel-halo" pathOptions={{ color: '#296fb7', weight: 3, fill: false }} />}
          <FlyTo m={sel} />
        </MapContainer>
      </div>
      <form className={`filters glass${fOpen ? ' open' : ''}`} aria-label="Map filters" onSubmit={(e) => e.preventDefault()}>
        <p className="hello">{greet()}. <span>Tap a circle to see what has been reported nearby.</span></p>
        <div className="row2">
          <div className="field hide-m"><label htmlFor="from">From</label><input id="from" type="date" className="input" value={filters.from} max={filters.to || todayISO()} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></div>
          <div className="field hide-m"><label htmlFor="to">To</label><input id="to" type="date" className="input" value={filters.to} min={filters.from} max={todayISO()} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></div>
          <button type="button" className="btn nearme" onClick={findMe}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /></svg>Near me</button>
          <LocationSelect id="jump" label="Jump to place" allLabel="Choose a place" value={selected} onChange={setSelected} cities={cities} />
        </div>
        <div className="chips hide-m" role="group" aria-label="Species">
          {Object.keys(SPECIES_COLOR).map((s) => (<button key={s} type="button" className="chip" aria-pressed={filters.species.includes(s)} onClick={() => toggle(s)}><span className="dot" style={{ background: SPECIES_COLOR[s] }} />{s}</button>))}
          {(filters.from || filters.to || filters.species.length > 0) && <button type="button" className="btn" onClick={() => setFilters({ from: '', to: '', species: [], location: '' })}>Clear filters</button>}
        </div>
        <p className="cap" role="status" aria-live="polite">{near ? near + ' ' : ''}<button type="button" className="linkbtn only-m" aria-expanded={fOpen} onClick={() => setFOpen((o) => !o)}>{fOpen ? 'Hide filters' : 'Dates and species'}</button> {badRange ? <span className="err">The start date is after the end date.</span> : markers ? `${total.toLocaleString('en-GB')} sightings across ${markers.length} places` : 'Loading sightings…'}</p>
        {error && <div className="banner error" role="alert">{error}</div>}
      </form>
      <div className="legend glass" aria-label="Map key"><b>Map key</b><span>Size: number of sightings</span><span>Colour: most reported species</span>
        <span>Ring: recent activity level</span><span className="lg">{(['low', 'moderate', 'high'] as Level[]).map((k) => <span key={k} className="lg" style={{ gap: 5 }}><span className="ring" style={{ ['--lc' as any]: LEVEL[k].color }} />{LEVEL[k].label}</span>)}</span></div>
      {hover && (() => { const { m, x, y, r } = hover; const below = y < 190;
        return <div className="tip maptip" role="presentation" style={{ left: Math.min(Math.max(x, 110), (typeof window !== 'undefined' ? window.innerWidth : 1200) - 110), top: below ? y + r + 10 : y - r - 10, transform: below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)' }}>
          <div className="t">{m.location}</div><div><span className="n">{m.count}</span> sightings</div>
          {m.topSpecies && <div className="r"><span className="dot" style={{ background: colorFor(m.topSpecies) }} />Most reported<b>{m.topSpecies}</b></div>}
          <div className="r">Latest report<b>{fmtDate(m.lastSeen)}</b></div><div className="r">Recent activity<b>{LEVEL[levels[m.location] ?? 'low'].label}</b></div></div>; })()}
      <AnimatePresence>{sel && <SightingPanel key="panel" marker={sel} level={levels[sel.location] ?? 'low'} onInsights={onInsights} onLearn={onLearn} filters={filters} onClose={() => setSelected('')} onReport={onReport} mobile={mobile} reduced={reduced} />}</AnimatePresence>
    </div>);
}
