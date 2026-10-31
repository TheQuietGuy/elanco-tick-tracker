import { useEffect, useState } from 'react';
import { api, ApiFailure, csvUrl } from '../api';
import type { City, Filters, Insights as I, Level, Marker, TrendPoint } from '../types';
import { LevelBadge } from '../components/Level';
import { CountUp } from '../components/CountUp';
import { BarList, LineChart } from '../components/charts';
import { LocationSelect } from '../components/Select';
import { colorFor, fmtDate, periodLabel, SPECIES_COLOR } from '../util';

interface P { cities: City[]; levels: Record<string, Level>; markers: Marker[] | null; initialLoc: string; onMap: (loc: string, species?: string) => void; onLearn: (sp: string) => void }
export default function Insights({ cities, levels, markers, initialLoc, onMap, onLearn }: P) {
  const [loc, setLoc] = useState(initialLoc);
  useEffect(() => { setLoc(initialLoc); }, [initialLoc]); const [interval, setInterval] = useState<'week' | 'month' | 'year'>('month');
  const [data, setData] = useState<I | null>(null); const [trend, setTrend] = useState<TrendPoint[] | null>(null); const [latest, setLatest] = useState(''); const [err, setErr] = useState('');
  const f: Filters = { from: '', to: '', species: [], location: loc };
  useEffect(() => { let live = true; setErr(''); setData(null); api.byRegion(f).then((d) => live && setData(d)).catch((e: ApiFailure) => live && setErr(e.message)); api.sightings(f, { limit: 1 }).then((s) => live && setLatest(s.data[0]?.date ?? '')).catch(() => {}); return () => { live = false; }; }, [loc]); // eslint-disable-line
  useEffect(() => { let live = true; setTrend(null); api.trends(f, interval).then((t) => live && setTrend(t.data)).catch((e: ApiFailure) => live && setErr(e.message)); return () => { live = false; }; }, [loc, interval]); // eslint-disable-line
  const top = data?.bySpecies[0];
  return (
    <div className="page">
      <header className="page-head">
        <div><h1>Tick activity across the UK</h1><p className="lead">Here is what {data ? data.total.toLocaleString('en-GB') : '…'} reports from vets and pet owners{loc ? ` in ${loc}` : ' across the UK'} tell us.</p></div>
        <div style={{ minWidth: 220, display: 'grid', gap: 8 }}><LocationSelect id="ins-loc" value={loc} onChange={setLoc} cities={cities} /><a className="btn no-print dl" href={csvUrl({ from: '', to: '', species: [], location: loc })} download="tick-sightings.csv">Download these sightings (CSV)</a>{loc && levels[loc] && <div className="linkrow" style={{ alignItems: 'center' }}><LevelBadge level={levels[loc]} prefix="Recent activity: " /><button className="linkbtn" onClick={() => onMap(loc)}>Open {loc} on map →</button></div>}</div>
      </header>
      {err && <div className="banner error" role="alert">{err}</div>}
      <section className="group" aria-label="At a glance">
        <div className="stat-grid" style={{ marginTop: 0, borderTop: 0 }}>
          <div className="stat"><b>{data ? <CountUp value={data.total} /> : '–'}</b><span>sightings</span></div>
          <div className="stat"><b>{data?.byLocation[0]?.location ?? '–'}</b><span>most reports</span></div>
          <div className="stat"><b style={{ fontSize: 20 }}>{top?.species ?? '–'}</b><span>most reported species</span></div>
          <div className="stat"><b style={{ fontSize: 20 }}>{latest ? fmtDate(latest) : '–'}</b><span>latest report</span></div>
        </div>
      </section>
      <section className="group" aria-labelledby="tr">
        <div className="gh"><h2 id="tr">Sightings over time</h2>
          <div className="seg" role="group" aria-label="Trend interval">{(['week', 'month', 'year'] as const).map((i) => <button key={i} aria-pressed={interval === i} onClick={() => setInterval(i)}>{{ week: 'Weekly', month: 'Monthly', year: 'Yearly' }[i]}</button>)}</div></div>
        <div className="gb">{trend ? <LineChart points={trend.map((t) => ({ x: periodLabel(t.period), tick: periodLabel(t.period, false), y: t.count, rows: Object.entries(SPECIES_COLOR).map(([label, color]) => ({ label, color, value: t.bySpecies[label] ?? 0 })) }))} label={`${interval}ly sightings${loc ? ` in ${loc}` : ''}`} height={240} /> : <div className="skeleton" style={{ height: 240 }} />}
          <p className="cap" style={{ marginTop: 8 }}>Hover, tap or use the arrow keys to see exact counts.</p></div>
      </section>
      <div className="grid2">
        <section className="group" aria-labelledby="sm"><div className="gh"><h2 id="sm">Species mix</h2></div><div className="gb">{data ? <><BarList onPick={(sp) => onMap(loc, sp)} rows={data.bySpecies.map((s) => ({ label: s.species, value: s.count, color: colorFor(s.species) }))} /><p className="cap" style={{ marginTop: 8 }}>Select a species to see it on the map. <button className="linkbtn" onClick={() => data.bySpecies[0] && onLearn(data.bySpecies[0].species)}>Learn about the most reported →</button></p></> : <div className="skeleton" style={{ height: 140 }} />}</div></section>
        <section className="group" aria-labelledby="rg"><div className="gh"><h2 id="rg">By region</h2></div><div className="gb">{data ? <BarList rows={data.byRegion.map((r) => ({ label: r.region, value: r.count }))} /> : <div className="skeleton" style={{ height: 200 }} />}</div></section>
      </div>
      <section className="group" aria-labelledby="pl"><div className="gh"><h2 id="pl">By place</h2></div><div className="gb">{data ? <div className="place-list">{data.byLocation.map((r) => <button key={r.location} onClick={() => onMap(r.location)} title="Open on map"><span className="pn">{r.location}<small>{r.region}</small></span><LevelBadge level={levels[r.location] ?? 'low'} /><b>{r.count}<span className="sr-only"> sightings. Open on map</span></b></button>)}</div> : <div className="skeleton" style={{ height: 200 }} />}<p className="cap" style={{ marginTop: 8 }}>Level compares each place's sightings in the final 12 months of data. Select a place to open it on the map.</p></div></section>
    </div>);
}
