import { useEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import type { PointerEvent as RPointerEvent } from 'react';
import { api, ApiFailure } from '../api';
import type { Filters, Insights, Level, Marker, Sighting, TrendPoint } from '../types';
import { LevelBadge } from '../components/Level';
import { CountUp } from '../components/CountUp';
import { BarList, LineChart } from '../components/charts';
import { colorFor, fmtDate, mapsDirections, periodLabel, SPECIES_COLOR } from '../util';

interface Props { level: Level; onInsights: (l: string) => void; onLearn: (sp: string) => void; marker: Marker; filters: Filters; onClose: () => void; onReport: (location: string) => void; mobile: boolean; reduced: boolean }

export default function SightingPanel({ level, onInsights, onLearn, marker, filters, onClose, onReport, mobile, reduced }: Props) {
  const [interval, setInterval] = useState<'month' | 'year'>('year');
  const [trend, setTrend] = useState<TrendPoint[] | null>(null);
  const [recent, setRecent] = useState<Sighting[] | null>(null);
  const [mix, setMix] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const sheetRef = useRef<HTMLElement>(null); const pull = useMotionValue(0); const bottom = useTransform(pull, (v) => -v);
  const gesture = useRef<{ y: number; lastY: number; lastT: number; v: number } | null>(null);
  const f: Filters = { ...filters, location: marker.location };
  const key = filters.species.join();

  useEffect(() => {
    let live = true; setRecent(null); setMix(null); setError(null);
    Promise.all([api.sightings(f, { limit: 8 }), api.byRegion(f)]).then(([s, m]) => { if (live) { setRecent(s.data); setMix(m); } }).catch((e: ApiFailure) => live && setError(e.message));
    return () => { live = false; };
  }, [marker.location, filters.from, filters.to, key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let live = true; setTrend(null);
    api.trends(f, interval).then((t) => live && setTrend(t.data)).catch((e: ApiFailure) => live && setError(e.message));
    return () => { live = false; };
  }, [marker.location, interval, filters.from, filters.to, key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);

  const share = async () => {
    const url = `${location.origin}/#/map/${encodeURIComponent(marker.location)}`; const text = `${marker.count} tick sightings reported in ${marker.location}`;
    try { if (navigator.share) { await navigator.share({ title: 'UK Tick Surveillance', text, url }); return; } await navigator.clipboard.writeText(url); setToast('Link copied'); }
    catch (e) { if ((e as Error).name !== 'AbortError') setToast('Could not share. Copy the address bar link instead.'); }
    setTimeout(() => setToast(''), 2500);
  };
  // Pull-down to dismiss. The sheet follows the finger; it closes only on a deliberate swipe (over a third of its height,
  // or a clearly fast flick with some distance). Anything shorter or slower springs back, so it never vanishes by accident.
  const down = (e: RPointerEvent<HTMLElement>) => { if (!mobile || (e.target as HTMLElement).closest('button')) return; e.currentTarget.setPointerCapture(e.pointerId); gesture.current = { y: e.clientY, lastY: e.clientY, lastT: e.timeStamp, v: 0 }; };
  const move = (e: RPointerEvent<HTMLElement>) => { const g = gesture.current; if (!g) return; pull.set(Math.max(0, e.clientY - g.y)); const dt = e.timeStamp - g.lastT; if (dt > 0) g.v = (e.clientY - g.lastY) / dt; g.lastY = e.clientY; g.lastT = e.timeStamp; };
  const up = () => { const g = gesture.current; if (!g) return; gesture.current = null; const dy = pull.get(), h = sheetRef.current?.offsetHeight ?? 500;
    if (dy > h * 0.35 || (g.v > 1.4 && dy > 90)) onClose(); else animate(pull, 0, reduced ? { duration: 0.1 } : { type: 'spring', bounce: 0, duration: 0.35 }); };

  const hidden = mobile ? { y: '100%' } : { x: '100%' };
  const spring = reduced ? { duration: 0.15 } : { type: 'spring' as const, bounce: 0, duration: 0.4 };
  return (
    <motion.aside ref={sheetRef} className="sheet glass" aria-label={`Sightings in ${marker.location}`} initial={reduced ? { opacity: 0 } : hidden} animate={{ x: 0, y: 0, opacity: 1 }} exit={reduced ? { opacity: 0 } : hidden} transition={spring} style={{ bottom: mobile ? bottom : undefined }}>
      <div className="drag-head" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <div className="grab-zone"><div className="grab" aria-hidden /></div>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'start' }}>
        <div><h2>{marker.location}</h2><p className="sub">{marker.region}</p><div style={{ marginTop: 8 }}><LevelBadge level={level} prefix="Recent activity: " /></div></div>
        <button className="btn" onClick={onClose} aria-label="Close details">Close</button>
      </header>
      </div>
      <div className="stat-row">
        <div className="stat"><b><CountUp value={marker.count} duration={0.7} /></b><span>sightings</span></div>
        <div className="stat"><b>{fmtDate(marker.lastSeen)}</b><span>latest report</span></div>
        <div className="stat"><b>{marker.recent}</b><span>in final 12 months of data</span></div>
      </div>
      <div className="actions">
        <a className="btn primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }} href={mapsDirections(marker.lat, marker.lng)} target="_blank" rel="noopener noreferrer">Get directions</a>
        <button className="btn" onClick={share}>Share</button>
        <button className="btn" onClick={() => onReport(marker.location)}>Report here</button>
        <button className="btn" onClick={() => onInsights(marker.location)}>View insights</button>
      </div>
      <p className="note">Activity level compares this place with the others by sightings in the final 12 months of the data. It describes how often ticks are reported here, not a medical risk.</p>
      <p className="cap" role="status" aria-live="polite" style={{ minHeight: 0 }}>{toast}</p>
      {error && <div className="banner error" role="alert">{error}</div>}
      <section aria-labelledby="tl"><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.5rem' }}>
        <h3 id="tl">Activity timeline</h3>
        <div className="seg" role="group" aria-label="Timeline interval">{(['year', 'month'] as const).map((i) => <button key={i} aria-pressed={interval === i} onClick={() => setInterval(i)}>{i === 'year' ? 'Yearly' : 'Monthly'}</button>)}</div></div>
        {trend ? <LineChart points={trend.map((t) => ({ x: periodLabel(t.period), tick: periodLabel(t.period, false), y: t.count, rows: Object.entries(SPECIES_COLOR).map(([label, color]) => ({ label, color, value: t.bySpecies[label] ?? 0 })) }))} label={`${interval === 'year' ? 'Yearly' : 'Monthly'} sightings in ${marker.location}`} height={170} /> : <div className="skeleton" style={{ height: 160 }} />}
      </section>
      <section aria-labelledby="sp"><h3 id="sp" style={{ marginBottom: '.5rem' }}>Species reported</h3>
        {mix ? <><BarList rows={mix.bySpecies.map((s) => ({ label: s.species, value: s.count, color: colorFor(s.species) }))} /><div className="linkrow" style={{ marginTop: 8 }}>{mix.bySpecies.slice(0, 3).map((s) => <button key={s.species} className="linkbtn" onClick={() => onLearn(s.species)}>About {s.species.toLowerCase()} →</button>)}</div></> : <div className="skeleton" style={{ height: 110 }} />}</section>
      <section aria-labelledby="rc"><h3 id="rc" style={{ marginBottom: '.5rem' }}>Latest sightings</h3>
        {!recent ? <div className="skeleton" style={{ height: 120 }} /> : recent.length === 0 ? <p className="sub">No sightings match the current filters.</p> :
          <ul className="list">{recent.map((s) => (<li key={s.id}><button aria-expanded={open === s.id} onClick={() => setOpen(open === s.id ? null : s.id)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontWeight: 600 }}><span className="dot" style={{ background: colorFor(s.species) }} />{s.species}<span className="cap" style={{ marginLeft: 'auto', fontWeight: 400 }}>{fmtDate(s.date)}</span></span>
            {open === s.id && <span className="sub" style={{ display: 'grid', gap: '.25rem' }}><span><i>{s.latinName}</i>, {s.region}</span><span>Report ID {s.id.slice(0, 10)}{s.source === 'user' ? ' (community report)' : ''}</span>
              {s.notes && <span>{s.notes}</span>}{s.imageUrl && <img className="thumb" src={s.imageUrl} alt={`Reported ${s.species}`} />}</span>}
          </button></li>))}</ul>}</section>
    </motion.aside>);
}
