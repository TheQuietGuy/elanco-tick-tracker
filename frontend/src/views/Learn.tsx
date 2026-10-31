import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { api, ApiFailure } from '../api';
import type { City, Insights, SeasonMonth, SpeciesInfo } from '../types';
import { SeasonChart } from '../components/charts';
import { LocationSelect } from '../components/Select';
import { TickArt } from '../components/TickArt';
import { colorFor, MONTHS, MONTHS_LONG } from '../util';
import { Listen } from '../components/Listen';
import { LevelBadge } from '../components/Level';

type Cat = 'walks' | 'home' | 'protect';
const CATS: Record<Cat, { label: string; color: string; icon: string }> = {
  walks: { label: 'After walks', color: '#296fb7', icon: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4-4' },
  home: { label: 'Home and garden', color: '#2f9e63', icon: 'M3 11.5 12 4l9 7.5M5.5 10v10h13V10M10 20v-5h4v5' },
  protect: { label: 'Protection and removal', color: '#c9791d', icon: 'M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3zm-3 9 2.2 2.2L15.5 10' },
};
const TIPS: { cat: Cat; title: string; body: string }[] = [
  { cat: 'walks', title: 'Check all over', body: 'Check your pet all over, especially around the ears, neck, armpits, groin and between the toes. Ticks can be as small as a poppy seed before they feed.' },
  { cat: 'walks', title: 'Use your fingers too', body: 'Brush through the coat with your fingers as well as your eyes. Many ticks are felt before they are seen.' },
  { cat: 'home', title: 'Keep the grass short', body: 'Keep grass short and clear leaf litter, especially where lawn meets hedge or woodland and ticks wait for a host.' },
  { cat: 'home', title: 'Wash and vacuum', body: 'Wash bedding regularly and vacuum where your pet sleeps, particularly if you have seen ticks in or around the house.' },
  { cat: 'home', title: 'Stick to the paths', body: 'Keep to paths where you can, and avoid brushing through long grass and bracken at the busiest times of year.' },
  { cat: 'protect', title: 'Ask your vet', body: 'Ask your vet which tick preventive suits your dog or cat. Treatments differ in how they work and how long they last, and some dog products are unsafe for cats.' },
  { cat: 'protect', title: 'Remove it promptly', body: 'If you find an attached tick, remove it promptly with a tick-removal tool or fine-tipped tweezers. Grip close to the skin and pull steadily upwards without twisting or squeezing the body.' },
  { cat: 'protect', title: 'Note the date', body: 'If your pet becomes lethargic, loses appetite or seems lame in the following weeks, contact your vet and mention the bite.' },
];

/** Prevention tips as a slideshow: arrows, dots, swipe/drag and left/right keys. No autoplay. */
function Slideshow() {
  const [[i, dir], set] = useState<[number, number]>([0, 0]); const reduce = useReducedMotion(); const n = TIPS.length;
  const go = (to: number) => set([Math.max(0, Math.min(n - 1, to)), to > i ? 1 : -1]);
  const t = TIPS[i]; const c = CATS[t.cat];
  const variants = reduce ? { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } } : { enter: (d: number) => ({ x: d * 70, opacity: 0 }), center: { x: 0, opacity: 1 }, exit: (d: number) => ({ x: d * -70, opacity: 0 }) };
  return (
    <div className="show" role="group" aria-roledescription="carousel" aria-label="Tips for preventing tick bites" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'ArrowRight') go(i + 1); if (e.key === 'ArrowLeft') go(i - 1); }}>
      <div className="show-stage">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div key={i} className="slide" style={{ ['--sc' as any]: c.color }} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${n}`} custom={dir} variants={variants} initial="enter" animate="center" exit="exit"
            transition={{ type: 'spring', bounce: 0, duration: 0.5 }} drag={reduce ? false : 'x'} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.25}
            onDragEnd={(_, info) => { const p = info.offset.x + info.velocity.x * 0.2; if (p < -80) go(i + 1); else if (p > 80) go(i - 1); }}>
            <div className="art" aria-hidden><span className="num">{String(i + 1).padStart(2, '0')}</span>
              <svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={c.icon} /></svg></div>
            <div className="copy"><span className="cat">{c.label}</span><h3>{t.title}</h3><p>{t.body}</p></div>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="show-nav">
        <button className="round" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous tip"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 5-7 7 7 7" /></svg></button>
        <div className="dots">{TIPS.map((_, k) => <button key={k} aria-label={`Tip ${k + 1}`} aria-current={k === i} onClick={() => go(k)} />)}</div>
        <button className="round" onClick={() => go(i + 1)} disabled={i === n - 1} aria-label="Next tip"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 5 7 7-7 7" /></svg></button>
      </div>
      <p className="sr-only" aria-live="polite">{`Tip ${i + 1} of ${n}: ${t.title}`}</p>
    </div>);
}
const spring = { type: 'spring' as const, bounce: 0.12, duration: 0.5 };
const CARD_R = 24;

function Strip({ months }: { months: number[] }) {
  return <div className="strip" role="img" aria-label={`Most active ${MONTHS_LONG[Math.min(...months) - 1]} to ${MONTHS_LONG[Math.max(...months) - 1]}`}>{Array.from({ length: 12 }, (_, i) => <i key={i} className={months.includes(i + 1) ? 'on' : ''} />)}</div>;
}

function Detail({ s, onClose, onReport, onMap }: { s: SpeciesInfo; onClose: () => void; onReport: () => void; onMap: (loc: string, sp: string) => void }) {
  const [months, setMonths] = useState<SeasonMonth[] | null>(null); const [where, setWhere] = useState<Insights | null>(null); const close = useRef<HTMLButtonElement>(null);
  useEffect(() => { let live = true; api.seasonality({ species: [s.species] }).then((r) => live && setMonths(r.months)).catch(() => {}); api.byRegion({ from: '', to: '', species: [s.species], location: '' }).then((r) => live && setWhere(r)).catch(() => {}); return () => { live = false; }; }, [s.species]);
  useEffect(() => { close.current?.focus(); const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  const c = colorFor(s.species);
  return (
    <>
      <motion.div className="scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
      <div className="sp-wrap">
        <motion.div layoutId={`card-${s.species}`} className="sp-sheet" style={{ borderRadius: CARD_R, ['--c' as any]: c }} role="dialog" aria-modal="true" aria-labelledby="sp-title" transition={spring}>
          <button ref={close} className="sp-close" onClick={onClose} aria-label="Close details"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></button>
          <motion.div layoutId={`art-${s.species}`} className="sp-hero" transition={spring}><TickArt species={s.species} size={168} /></motion.div>
          <motion.div className="sp-content" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: 0.12, duration: 0.3 }}>
            <header style={{ display: 'grid', gap: 6 }}><h2 id="sp-title" style={{ fontSize: 30, letterSpacing: '-0.03em' }}>{s.species}</h2><p className="sub" style={{ fontStyle: 'italic', fontSize: 15 }}>{s.latinName}</p></header>
            <Listen text={`${s.species}. ${s.identify} Usual hosts: ${s.hosts}. Why it matters: ${s.risk}`} label="Listen to this summary" />
            <section aria-labelledby="how"><h3 id="how" style={{ marginBottom: 6 }}>How to recognise it</h3><p style={{ maxWidth: '60ch' }}>{s.identify}</p><p className="cap" style={{ marginTop: 6 }}>Illustration is a guide to general appearance and is not to scale. Adult ticks are typically a few millimetres long.</p></section>
            <section className="group" aria-label="Facts">
              <div className="row"><span className="l">Usual hosts</span><span style={{ textAlign: 'right' }}>{s.hosts}</span></div>
              <div className="row"><span className="l">Where it lives</span><span style={{ textAlign: 'right' }}>{s.habitat}</span></div>
              <div className="row"><span className="l">Concern for pets</span><LevelBadge level={s.severity} /></div>
              <div className="row"><span className="l">Why it matters</span><span style={{ textAlign: 'right', maxWidth: '60%' }}>{s.risk}</span></div>
              <div className="row"><span className="l">Reported in this data</span><b>{s.sightings.toLocaleString('en-GB')}</b></div>
            </section>
            <section aria-labelledby="when"><h3 id="when" style={{ marginBottom: 8 }}>When it is reported</h3>
              {months ? <SeasonChart months={months} single={c} label={`Monthly sightings of ${s.species}`} height={180} /> : <div className="skeleton" style={{ height: 180 }} />}</section>
            {where && where.byLocation.length > 0 && <section aria-labelledby="top"><h3 id="top" style={{ marginBottom: 8 }}>Most reported in</h3>
              <div className="group">{where.byLocation.slice(0, 3).map((l) => <button className="row linkbtn" style={{ width: '100%', color: 'inherit' }} key={l.location} onClick={() => onMap(l.location, s.species)}><span>{l.location} <span className="cap">{l.region}</span></span><b>{l.count}</b></button>)}</div></section>}
            <div className="actions"><button className="btn primary lg" onClick={onReport}>Report a {s.species.toLowerCase()}</button><button className="btn lg" onClick={() => onMap('', s.species)}>See on map</button><button className="btn lg" onClick={onClose}>Done</button></div>
          </motion.div>
        </motion.div>
      </div>
    </>);
}

export default function Learn({ cities, openSpecies, onReport, onMap }: { cities: City[]; openSpecies: string; onReport: (species: string) => void; onMap: (loc: string, sp: string) => void }) {
  const [species, setSpecies] = useState<SpeciesInfo[] | null>(null); const [open, setOpen] = useState<string | null>(null); const trigger = useRef<HTMLElement | null>(null);
  const [loc, setLoc] = useState('London'); const [months, setMonths] = useState<SeasonMonth[] | null>(null); const [err, setErr] = useState('');
  useEffect(() => { if (openSpecies) setOpen(openSpecies); }, [openSpecies]);
  useEffect(() => { api.species().then(setSpecies).catch((e: ApiFailure) => setErr(e.message)); }, []);
  useEffect(() => { let live = true; setMonths(null); api.seasonality({ location: loc }).then((s) => live && setMonths(s.months)).catch((e: ApiFailure) => live && setErr(e.message)); return () => { live = false; }; }, [loc]);
  const close = () => { setOpen(null); setTimeout(() => trigger.current?.focus(), 350); };
  const cur = species?.find((s) => s.species === open);
  return (
    <div className="page">
      <header className="page-head"><div><h1>Know your ticks</h1><p className="lead">Found something small and crawly? Here is how to tell what it is, when to expect it, and how to keep your pets safe.</p></div><button type="button" className="btn no-print" onClick={() => window.print()}>Print this guide</button></header>
      {err && <div className="banner error" role="alert">{err}</div>}

      <section aria-labelledby="idg" style={{ display: 'grid', gap: 16 }}>
        <div><h2 id="idg">Identification guide</h2><p className="sub" style={{ marginTop: 4 }}>Select a tick to see how to recognise it and when it is reported.</p></div>
        <div className="sp-grid">{species ? species.map((s) => (
          <motion.button key={s.species} layoutId={`card-${s.species}`} className="sp-card" style={{ borderRadius: CARD_R, ['--c' as any]: colorFor(s.species), visibility: open === s.species ? 'hidden' : 'visible' }} transition={spring}
            onClick={(e) => { trigger.current = e.currentTarget; setOpen(s.species); }} aria-haspopup="dialog">
            <motion.div layoutId={`art-${s.species}`} className="sp-art" transition={spring}><TickArt species={s.species} size={116} label={false} /></motion.div>
            <div className="sp-body"><div><h3>{s.species}</h3><p className="latin">{s.latinName}</p></div><LevelBadge level={s.severity} prefix="Pet concern: " /><Strip months={s.peakMonths} /><p className="cap">Most active {MONTHS[Math.min(...s.peakMonths) - 1]} to {MONTHS[Math.max(...s.peakMonths) - 1]}<span className="sr-only">. Open details</span></p></div>
          </motion.button>)) : Array.from({ length: 5 }, (_, i) => <div key={i} className="skeleton" style={{ height: 270, borderRadius: CARD_R }} />)}</div>
        <p className="cap">Pet concern is an indicative rating of how much harm the species typically causes to dogs and cats, not a diagnosis. Identification here is a guide only. If you are unsure or your pet is unwell, ask your vet.</p>
      </section>
      <AnimatePresence>{cur && <Detail key="detail" s={cur} onClose={close} onReport={() => { setOpen(null); onReport(cur.species); }} onMap={onMap} />}</AnimatePresence>

      <section className="group" aria-labelledby="ss">
        <div className="gh"><div><h2 id="ss">Seasonal activity</h2><p className="sub" style={{ marginTop: 2 }}>Sightings by calendar month, all years combined.</p></div><div style={{ minWidth: 190 }}><LocationSelect id="season-loc" value={loc} onChange={setLoc} cities={cities} allLabel="All UK" label="Place" /></div></div>
        <div className="gb">{months ? <SeasonChart months={months} label={`Seasonal sightings${loc ? ` in ${loc}` : ' across the UK'}`} /> : <div className="skeleton" style={{ height: 220 }} />}<p className="cap" style={{ marginTop: 8 }}>Hover, tap or use the arrow keys to see each month.</p></div>
      </section>

      <section style={{ display: 'grid', gap: 16 }} aria-labelledby="pv"><div><h2 id="pv">Preventing tick bites</h2><p className="sub" style={{ marginTop: 4 }}>Eight small habits that make a big difference. Swipe, or use the arrows.</p></div><Slideshow />
        <ol className="print-only">{TIPS.map((t, k) => <li key={k}><b>{t.title}.</b> {t.body}</li>)}</ol></section>
    </div>);
}
