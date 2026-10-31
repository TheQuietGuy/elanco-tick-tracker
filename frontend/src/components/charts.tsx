import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { MONTHS, MONTHS_LONG, SPECIES_COLOR } from '../util';
import type { SeasonMonth } from '../types';

/** Measure the container so charts draw at real pixel size and keep their text crisp. */
function useWidth(initial = 560) {
  const ref = useRef<HTMLDivElement>(null); const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    setW(Math.max(220, Math.round(el.clientWidth)));
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(220, Math.round(e.contentRect.width)))); ro.observe(el); return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Round the axis maximum to a friendly step so gridlines read 0, 5, 10 rather than 0, 4.3, 8.6. */
function niceScale(max: number, ticks = 4) {
  const raw = Math.max(1, max) / ticks; const pow = 10 ** Math.floor(Math.log10(raw)); const f = raw / pow;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow; const top = Math.ceil(max / step) * step || step;
  return { step, top, values: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step) };
}

/** Tooltip that stays inside the chart: above the point when there is room, otherwise beside it. */
function Tip({ x, y, w, children }: { x: number; y: number; w: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null); const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return; const tw = el.offsetWidth, th = el.offsetHeight; const H = el.parentElement?.querySelector('svg')?.clientHeight ?? 200;
    let left = Math.min(Math.max(x - tw / 2, 4), w - tw - 4), top = y - th - 12;
    if (top < 2) { left = x + 16 + tw <= w - 4 ? x + 16 : Math.max(4, x - 16 - tw); top = Math.min(Math.max(y - th / 2, 2), Math.max(2, H - th - 2)); }
    setPos((p) => (p && p.left === left && p.top === top ? p : { left, top }));
  }, [x, y, w]);
  return <div ref={ref} className="tip" style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden' }} role="presentation">{children}</div>;
}

/** Text alternative for a chart: the same numbers in a table, collapsed by default. */
export function DataTable({ caption, head, rows }: { caption: string; head: [string, string]; rows: (string | number)[][] }) {
  return (<details className="dt"><summary>View data as a table</summary><div className="scroll" tabIndex={0} role="region" aria-label={caption}><table><caption className="sr-only">{caption}</caption><thead><tr><th scope="col">{head[0]}</th><th scope="col">{head[1]}</th></tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i}><td>{r[0]}</td><td>{r[1]}</td></tr>)}</tbody></table></div></details>);
}

export function BarList({ rows, color, onPick }: { rows: { label: string; value: number; color?: string }[]; color?: string; onPick?: (label: string) => void }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (<div className="barlist" role="list">{rows.map((r) => (
    <div className="r" role="listitem" key={r.label} title={`${r.label}: ${r.value}`}>{onPick ? <button className="linkbtn" style={{ color: 'inherit', fontWeight: 500 }} onClick={() => onPick(r.label)} aria-label={`${r.label}, ${r.value}. Open`}>{r.label}</button> : <span>{r.label}</span>}
      <div className="track" aria-hidden><div className="fill" style={{ width: `${(r.value / max) * 100}%`, background: r.color ?? color }} /></div><b>{r.value}</b></div>))}</div>);
}

export interface LinePoint { x: string; tick: string; y: number; rows?: { label: string; value: number; color?: string }[] }

/** Area chart with a hover/touch/keyboard crosshair and a callout showing exact values. */
export function LineChart({ points, label, height = 200, unit = 'sightings' }: { points: LinePoint[]; label: string; height?: number; unit?: string }) {
  const [box, W] = useWidth(); const [hi, setHi] = useState<number | null>(null); const [kb, setKb] = useState(false);
  const n = points.length;
  if (!n) return <p className="sub">No sightings in this range.</p>;
  const H = height, pl = 30, pr = 6, pt = 8, pb = 24;
  const sc = niceScale(Math.max(...points.map((p) => p.y))); const iw = W - pl - pr, ih = H - pt - pb;
  const X = (i: number) => pl + (n === 1 ? iw / 2 : (i / (n - 1)) * iw); const Y = (v: number) => pt + (1 - v / sc.top) * ih;
  const smooth = n <= 48; let d = `M${X(0)} ${Y(points[0].y)}`;
  if (smooth && n > 2) { for (let i = 1; i < n - 1; i++) { const mx = (X(i) + X(i + 1)) / 2, my = (Y(points[i].y) + Y(points[i + 1].y)) / 2; d += `Q${X(i)} ${Y(points[i].y)} ${mx} ${my}`; } d += `L${X(n - 1)} ${Y(points[n - 1].y)}`; }
  else for (let i = 1; i < n; i++) d += `L${X(i)} ${Y(points[i].y)}`;
  const area = `${d}L${X(n - 1)} ${pt + ih}L${X(0)} ${pt + ih}Z`;
  const peak = points.reduce((a, b) => (b.y > a.y ? b : a));
  const tickN = Math.min(W < 420 ? 3 : 5, n); const ticks = Array.from(new Set(Array.from({ length: tickN }, (_, i) => Math.round((i / Math.max(1, tickN - 1)) * (n - 1)))));
  const idxAt = (clientX: number) => { const r = box.current!.getBoundingClientRect(); return Math.min(n - 1, Math.max(0, Math.round(((clientX - r.left - pl) / iw) * (n - 1)))); };
  const onMove = (e: PointerEvent) => { setKb(false); setHi(idxAt(e.clientX)); };
  const onKey = (e: KeyboardEvent) => {
    const k = e.key; if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(k)) return; e.preventDefault(); setKb(true);
    setHi((c) => (k === 'Escape' ? null : k === 'Home' ? 0 : k === 'End' ? n - 1 : Math.min(n - 1, Math.max(0, (c ?? (k === 'ArrowRight' ? -1 : n)) + (k === 'ArrowRight' ? 1 : -1)))));
  };
  const cur = hi != null ? points[hi] : null;
  return (
    <div className="chartbox" ref={box}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="group" tabIndex={0} aria-roledescription="line chart" aria-label={`${label}. Peak of ${peak.y} in ${peak.x}. Use left and right arrow keys to read values.`}
        onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => !kb && setHi(null)} onKeyDown={onKey} onBlur={() => { setHi(null); setKb(false); }}>
        <defs><linearGradient id={`g-${label.length}-${n}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#296fb7" stopOpacity=".22" /><stop offset="1" stopColor="#296fb7" stopOpacity="0" /></linearGradient></defs>
        {sc.values.map((v) => <g key={v}><line x1={pl} x2={W - pr} y1={Y(v)} y2={Y(v)} className="gl" /><text x={pl - 8} y={Y(v) + 4} textAnchor="end">{v}</text></g>)}
        <path d={area} fill={`url(#g-${label.length}-${n})`} /><path d={d} fill="none" stroke="#296fb7" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {ticks.map((i) => <text key={i} x={X(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{points[i].tick}</text>)}
        {hi != null && cur && <g><line x1={X(hi)} x2={X(hi)} y1={pt} y2={pt + ih} className="xh" strokeDasharray="3 3" /><circle cx={X(hi)} cy={Y(cur.y)} r="9" fill="#296fb7" opacity=".16" /><circle cx={X(hi)} cy={Y(cur.y)} r="4.5" stroke="#296fb7" className="dotfill" strokeWidth="2.5" /></g>}
      </svg>
      {hi != null && cur && <Tip x={X(hi)} y={Y(cur.y)} w={W}><div className="t">{cur.x}</div><div><span className="n">{cur.y}</span> {cur.y === 1 ? unit.replace(/s$/, '') : unit}</div>
        {cur.rows?.filter((r) => r.value > 0).map((r) => <div className="r" key={r.label}><span className="dot" style={{ background: r.color }} />{r.label}<b>{r.value}</b></div>)}</Tip>}
      <p className="sr-only" aria-live="polite">{kb && cur ? `${cur.x}: ${cur.y} ${unit}` : ''}</p>
      <DataTable caption={`${label}, data table`} head={['Period', unit[0].toUpperCase() + unit.slice(1)]} rows={points.map((p) => [p.x, p.y])} />
    </div>);
}

/** Twelve monthly columns. Stacked by species, or a single colour when `single` is provided. Hover or arrow keys reveal a breakdown. */
export function SeasonChart({ months, label, single, height = 220 }: { months: SeasonMonth[]; label: string; single?: string; height?: number }) {
  const [box, W] = useWidth(); const [hi, setHi] = useState<number | null>(null); const [kb, setKb] = useState(false);
  const names = Object.keys(SPECIES_COLOR); const H = height, pl = 30, pr = 4, pt = 8, pb = 24; const iw = W - pl - pr, ih = H - pt - pb;
  const sc = niceScale(Math.max(...months.map((m) => m.total))); const bw = iw / 12; const peak = months.reduce((a, b) => (b.total > a.total ? b : a)); const all = months.reduce((a, m) => a + m.total, 0);
  const Y = (v: number) => pt + (1 - v / sc.top) * ih;
  const idxAt = useCallback((cx: number) => { const r = box.current!.getBoundingClientRect(); return Math.min(11, Math.max(0, Math.floor((cx - r.left - pl) / bw))); }, [bw, box]);
  const onKey = (e: KeyboardEvent) => { const k = e.key; if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(k)) return; e.preventDefault(); setKb(true); setHi((c) => (k === 'Escape' ? null : k === 'Home' ? 0 : k === 'End' ? 11 : Math.min(11, Math.max(0, (c ?? (k === 'ArrowRight' ? -1 : 12)) + (k === 'ArrowRight' ? 1 : -1))))); };
  const m = hi != null ? months[hi] : null;
  return (
    <div>
      <div className="chartbox" ref={box}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="group" tabIndex={0} aria-roledescription="bar chart" aria-label={`${label}. Busiest month: ${MONTHS_LONG[peak.month - 1]} with ${peak.total} sightings. Use arrow keys to read each month.`}
          onPointerMove={(e) => { setKb(false); setHi(idxAt(e.clientX)); }} onPointerDown={(e) => setHi(idxAt(e.clientX))} onPointerLeave={() => !kb && setHi(null)} onKeyDown={onKey} onBlur={() => { setHi(null); setKb(false); }}>
          {sc.values.map((v) => <g key={v}><line x1={pl} x2={W - pr} y1={Y(v)} y2={Y(v)} className="gl" /><text x={pl - 8} y={Y(v) + 4} textAnchor="end">{v}</text></g>)}
          {months.map((mo, i) => {
            const x = pl + i * bw + bw * 0.16, w = bw * 0.68; const dim = hi != null && hi !== i; let acc = 0;
            const segs = single ? [{ n: 'all', v: mo.total, c: single }] : names.map((nm) => ({ n: nm, v: mo.bySpecies[nm] ?? 0, c: SPECIES_COLOR[nm] }));
            return <g key={mo.month} opacity={dim ? 0.38 : 1} style={{ transition: 'opacity 120ms' }}>
              {hi === i && <rect x={pl + i * bw} y={pt} width={bw} height={ih} className="hv" rx="6" />}
              {segs.map((sg, si) => { if (!sg.v) return null; const h = (sg.v / sc.top) * ih; acc += h; const last = si === segs.length - 1 || segs.slice(si + 1).every((q) => !q.v);
                return <rect key={sg.n} x={x} width={w} y={pt + ih - acc} height={h} fill={sg.c} rx={last ? 4 : 0} />; })}
              <text x={x + w / 2} y={H - 6} textAnchor="middle" style={{ fill: hi === i ? 'var(--ink)' : undefined, fontWeight: hi === i ? 650 : 400 }}>{W < 380 ? MONTHS[i][0] : MONTHS[i]}</text></g>; })}
        </svg>
        {m && hi != null && <Tip x={pl + hi * bw + bw / 2} y={Y(m.total)} w={W}><div className="t">{MONTHS_LONG[hi]}</div><div><span className="n">{m.total}</span> {m.total === 1 ? 'sighting' : 'sightings'}{all ? ` · ${Math.round((m.total / all) * 100)}% of the year` : ''}</div>
          {!single && names.filter((nm) => m.bySpecies[nm]).map((nm) => <div className="r" key={nm}><span className="dot" style={{ background: SPECIES_COLOR[nm] }} />{nm}<b>{m.bySpecies[nm]}</b></div>)}</Tip>}
        <p className="sr-only" aria-live="polite">{kb && m && hi != null ? `${MONTHS_LONG[hi]}: ${m.total} sightings` : ''}</p>
      </div>
      <DataTable caption={`${label}, data table`} head={['Month', 'Sightings']} rows={months.map((mo) => [MONTHS_LONG[mo.month - 1], mo.total])} />
      {!single && <div style={{ display: 'flex', gap: '6px 16px', flexWrap: 'wrap', marginTop: 10 }} className="cap">{names.map((nm) => <span key={nm} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span className="dot" style={{ background: SPECIES_COLOR[nm] }} />{nm}</span>)}</div>}
    </div>);
}
