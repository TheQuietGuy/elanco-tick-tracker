import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { api, ApiFailure } from '../api';
import type { City, Level, SpeciesInfo } from '../types';
import { LevelBadge } from '../components/Level';
import { locate, nearestCity } from '../util';
import { TickArt } from '../components/TickArt';
import { colorFor, fmtDate, todayISO } from '../util';

const MAX_MB = 5; const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
type Field = 'date' | 'location' | 'species' | 'notes' | 'image'; type Errors = Partial<Record<Field, string>>;
const Warn = () => <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden style={{ flex: 'none', marginTop: 3 }}><circle cx="8" cy="8" r="8" fill="currentColor" /><path d="M8 4v5M8 11.2v.4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" /></svg>;
const Tick = () => <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M2.5 6.5l2.3 2.3L9.5 3.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;

export default function ReportForm({ cities, species, presetLocation, presetSpecies, levels, onViewMap, onLearn }: { cities: City[]; species: SpeciesInfo[]; presetLocation: string; presetSpecies: string; levels: Record<string, Level>; onViewMap: (l: string) => void; onLearn: (sp: string) => void }) {
  const [date, setDate] = useState(todayISO()); const [location, setLocation] = useState(presetLocation); const [sp, setSp] = useState(presetSpecies); const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null); const [fileErr, setFileErr] = useState(''); const [preview, setPreview] = useState(''); const [over, setOver] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({}); const [submitted, setSubmitted] = useState(false); const [server, setServer] = useState<Errors>({});
  const [busy, setBusy] = useState(false); const [formError, setFormError] = useState(''); const [done, setDone] = useState<{ location: string; species: string; date: string; warnings: string[] } | null>(null);
  const summary = useRef<HTMLDivElement>(null);
  useEffect(() => { if (presetLocation) setLocation(presetLocation); }, [presetLocation]);
  useEffect(() => { if (presetSpecies) setSp(presetSpecies); }, [presetSpecies]);
  useEffect(() => { if (!file) { setPreview(''); return; } const u = URL.createObjectURL(file); setPreview(u); return () => URL.revokeObjectURL(u); }, [file]);

  const errors = useMemo<Errors>(() => {
    const e: Errors = {};
    if (!date) e.date = 'Enter the date you found the tick.'; else if (date > todayISO()) e.date = 'The date cannot be in the future.';
    if (!location) e.location = 'Choose the nearest city.';
    if (!sp) e.species = 'Choose a species. If unsure, pick the closest match from the guide.';
    if (notes.length > 500) e.notes = `Notes are ${notes.length - 500} characters too long.`;
    if (fileErr) e.image = fileErr;
    return { ...e, ...server };
  }, [date, location, sp, notes, fileErr, server]);
  const show = (f: Field) => ((submitted || touched[f]) ? errors[f] : undefined);
  const touch = (f: Field) => setTouched((t) => ({ ...t, [f]: true }));
  const list = (Object.keys(errors) as Field[]).filter((f) => submitted && errors[f]);

  const pick = (f: File | undefined | null) => {
    setServer((s) => ({ ...s, image: undefined })); touch('image'); setFileErr('');
    if (!f) return setFile(null);
    if (!TYPES.includes(f.type)) { setFile(null); return setFileErr('Use a JPEG, PNG or WebP image.'); }
    if (f.size > MAX_MB * 1024 * 1024) { setFile(null); return setFileErr(`That image is ${(f.size / 1048576).toFixed(1)} MB. The limit is ${MAX_MB} MB.`); }
    setFile(f);
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files?.[0]); };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault(); setSubmitted(true); setFormError('');
    if (Object.values(errors).some(Boolean)) { setTimeout(() => summary.current?.focus(), 0); return; }
    const fd = new FormData(); fd.set('date', date); fd.set('location', location); fd.set('species', sp); if (notes.trim()) fd.set('notes', notes.trim()); if (file) fd.set('image', file);
    setBusy(true);
    try { const r = await api.report(fd); setDone({ location: r.sighting.location, species: r.sighting.species, date: r.sighting.date, warnings: r.warnings }); }
    catch (x) {
      const f = x as ApiFailure; const m: Errors = {}; f.fields?.forEach((d) => ((m as any)[d.field] = d.message)); setServer(m);
      setFormError(f.message); setTimeout(() => summary.current?.focus(), 0);
    } finally { setBusy(false); }
  };
  const reset = () => { setDone(null); setSp(''); setNotes(''); setFile(null); setFileErr(''); setServer({}); setTouched({}); setSubmitted(false); setDate(todayISO()); };
  const chosen = species.find((s) => s.species === sp);
  const [where, setWhere] = useState('');
  const useMyLocation = () => { setWhere('Finding your nearest city…'); locate().then((p) => { const c = nearestCity(cities, p.lat, p.lng); if (c) { setLocation(c.name); setWhere(`We picked ${c.name}, your nearest city. Change it if that is not right.`); } }).catch((e: Error) => setWhere(e.message)); };

  if (done) return (
    <div className="page rep"><div className="group done" role="status">
      <motion.div className="ring" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', bounce: 0.3, duration: 0.5 }}>
        <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden><motion.path d="M9 19l6 6 12-13" fill="none" stroke="#1b7f55" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.2, duration: 0.4 }} /></svg></motion.div>
      <div style={{ display: 'grid', gap: 6 }}><h1 style={{ fontSize: 28 }}>Sighting saved. Thank you!</h1><p className="lead" style={{ margin: '0 auto' }}>You have just helped other pet owners in {done.location} know what to look out for.</p></div>
      <div className="sum"><TickArt species={done.species} size={52} label={false} /><div><b>{done.species}</b><p className="sub">{done.location} · {fmtDate(done.date)}</p></div></div>
      {done.warnings.map((w) => <div key={w} className="banner warn" style={{ textAlign: 'left', maxWidth: 480 }}>{w}</div>)}
      <div className="actions" style={{ justifyContent: 'center' }}><button className="btn primary lg" onClick={() => onViewMap(done.location)}>View {done.location} on the map</button><button className="btn lg" onClick={reset}>Report another</button></div>
    </div></div>);

  return (
    <form className="page rep" noValidate onSubmit={submit}>
      <header className="page-head"><div><h1>Report a sighting</h1><p className="lead">Found a tick? Thank you for telling us. Your report helps other pet owners and vets nearby. We only show the city, date and species.</p></div></header>
      <div ref={summary} tabIndex={-1} aria-live="assertive" style={{ outline: 'none' }}>
        {(list.length > 0 || formError) && <div className="banner error"><b>{formError || 'Please fix the following:'}</b>
          {list.length > 0 && <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{list.map((k) => <li key={k}><a href={`#f-${k}`} onClick={(e) => { e.preventDefault(); (document.getElementById(`f-${k}`) ?? document.querySelector<HTMLElement>('.sp-pick input'))?.focus(); }}>{errors[k]}</a></li>)}</ul>}</div>}
      </div>

      <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 12 }} aria-describedby={show('species') ? 'e-species' : undefined}>
        <legend style={{ padding: 0, marginBottom: 12 }}><h2 style={{ display: 'inline' }}>What did you find?</h2></legend>
        <div className="sp-pick" role="radiogroup" aria-label="Species">
          {species.map((s, i) => (
            <label key={s.species}><input id={i === 0 ? 'f-species' : undefined} type="radio" name="species" value={s.species} checked={sp === s.species} onChange={() => { setSp(s.species); touch('species'); setServer((x) => ({ ...x, species: undefined })); }} />
              <span className="tile" style={{ ['--c' as any]: colorFor(s.species) }}><span className="art"><TickArt species={s.species} size={64} label={false} /></span>{s.species}</span>
              <span className="tick"><Tick /></span></label>))}
        </div>
        {chosen ? <div className="note" aria-live="polite"><span><i>{chosen.latinName}</i>. {chosen.identify}</span><span style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}><LevelBadge level={chosen.severity} prefix="Pet concern: " /><button type="button" className="linkbtn" onClick={() => onLearn(chosen.species)}>Full guide →</button></span></div> : <p className="sub">Not sure? Check the identification guide first.</p>}
        {show('species') && <p className="err" id="e-species"><Warn />{errors.species}</p>}
      </fieldset>

      <section style={{ display: 'grid', gap: 12 }} aria-labelledby="wh"><h2 id="wh">Where and when</h2>
        <div className="group">
          <div className="row"><label className="l" htmlFor="f-location">Nearest city</label>
            <select id="f-location" className="row-input" value={location} onChange={(e) => { setLocation(e.target.value); setServer((x) => ({ ...x, location: undefined })); }} onBlur={() => touch('location')} aria-invalid={!!show('location')} aria-describedby={show('location') ? 'e-location' : undefined}>
              <option value="">Choose a city</option>{[...cities].sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}</select></div>
          <div className="row"><label className="l" htmlFor="f-date">Date found</label>
            <input id="f-date" type="date" className="row-input" value={date} max={todayISO()} onChange={(e) => { setDate(e.target.value); setServer((x) => ({ ...x, date: undefined })); }} onBlur={() => touch('date')} aria-invalid={!!show('date')} aria-describedby={show('date') ? 'e-date' : undefined} /></div>
        </div>
        <p className="cap" role="status" aria-live="polite">{where || <button type="button" className="linkbtn" onClick={useMyLocation}>Use my location to pick the nearest city</button>}</p>
        {location && levels[location] && <div className="note" aria-live="polite"><span style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}><LevelBadge level={levels[location]} prefix={`Recent activity in ${location}: `} /><button type="button" className="linkbtn" onClick={() => onViewMap(location)}>See {location} on the map →</button></span></div>}
        {show('location') && <p className="err" id="e-location"><Warn />{errors.location}</p>}{show('date') && <p className="err" id="e-date"><Warn />{errors.date}</p>}
      </section>

      <section style={{ display: 'grid', gap: 12 }} aria-labelledby="ph"><h2 id="ph">Photo <span className="cap" style={{ fontWeight: 400 }}>optional</span></h2>
        {file ? <div className="photo-row">{preview && <img src={preview} alt="Preview of the selected photo" />}<div style={{ flex: 1, minWidth: 0 }}><b style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</b><span className="cap">{(file.size / 1048576).toFixed(1)} MB</span></div><button type="button" className="btn" onClick={() => pick(null)}>Remove</button></div>
          : <label className={`drop${over ? ' over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop} htmlFor="f-image">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="var(--blue)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="4" y="7" width="24" height="19" rx="5" /><circle cx="16" cy="16.5" r="4.5" /><path d="M11 7l1.6-2.5h6.8L21 7" /></svg>
            <b>Add a photo</b><span className="sub">Drop an image here or choose one. JPEG, PNG or WebP, up to {MAX_MB} MB. A clear close-up helps with identification.</span>
            <input id="f-image" type="file" accept={TYPES.join(',')} onChange={(e) => pick(e.target.files?.[0])} aria-describedby={show('image') ? 'e-image' : undefined} /></label>}
        {show('image') && <p className="err" id="e-image"><Warn />{errors.image}</p>}
      </section>

      <section style={{ display: 'grid', gap: 12 }} aria-labelledby="nh"><h2 id="nh">Notes <span className="cap" style={{ fontWeight: 400 }}>optional</span></h2>
        <textarea id="f-notes" aria-labelledby="nh" className="input" rows={3} value={notes} placeholder="Where was your pet walking? Was the tick attached?" onChange={(e) => setNotes(e.target.value)} onBlur={() => touch('notes')} aria-invalid={!!show('notes')} aria-describedby="h-notes" />
        <p className="cap" id="h-notes" style={{ textAlign: 'right' }}>{notes.length}/500</p>{show('notes') && <p className="err"><Warn />{errors.notes}</p>}
      </section>

      <div className="submitbar"><p className="cap" style={{ maxWidth: 300 }}>It appears on the map straight away.</p><button className="btn primary lg" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Submit sighting'}</button></div>
    </form>);
}
