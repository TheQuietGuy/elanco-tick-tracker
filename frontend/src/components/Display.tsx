import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Prefs } from '../prefs';

interface Props { prefs: Prefs; update: (p: Partial<Prefs>) => void; reset: () => void; onHelp: () => void }

const Seg = ({ label, options, value, onPick }: { label: string; options: { v: number | boolean; t: string }[]; value: number | boolean; onPick: (v: any) => void }) => (
  <div className="dsp-row"><span className="dsp-l" id={`dl-${label}`}>{label}</span>
    <div className="seg" role="group" aria-labelledby={`dl-${label}`}>{options.map((o) => <button key={String(o.v)} type="button" aria-pressed={value === o.v} onClick={() => onPick(o.v)}>{o.t}</button>)}</div></div>);

/** "Display and accessibility" popover: text size, contrast, motion and navigation visibility. */
export function Display({ prefs, update, reset, onHelp }: Props) {
  const [open, setOpen] = useState(false); const btn = useRef<HTMLButtonElement>(null); const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>('button')?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); } };
    const down = (e: PointerEvent) => { const t = e.target as Node; if (!panel.current?.contains(t) && !btn.current?.contains(t)) setOpen(false); };
    window.addEventListener('keydown', key); window.addEventListener('pointerdown', down);
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('pointerdown', down); };
  }, [open]);
  return (
    <div className="dsp">
      <button ref={btn} className="theme-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="dialog" aria-controls="dsp-panel" aria-label="Display and accessibility settings" title="Display and accessibility">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="4.6" r="1.8" /><path d="M5 8.5c4.5 1.4 9.5 1.4 14 0M12 9v5m0 0-3 6m3-6 3 6" /></svg></button>
      <AnimatePresence>{open && (
        <motion.div id="dsp-panel" ref={panel} className="dsp-panel glass" role="dialog" aria-label="Display and accessibility settings" initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.97 }} transition={{ type: 'spring', bounce: 0, duration: 0.3 }}>
          <h2>Make it comfortable</h2>
          <Seg label="Text size" value={prefs.size} onPick={(v) => update({ size: v })} options={[{ v: 0, t: 'Default' }, { v: 1, t: 'Large' }, { v: 2, t: 'Largest' }]} />
          <Seg label="Contrast" value={prefs.contrast} onPick={(v) => update({ contrast: v })} options={[{ v: false, t: 'Standard' }, { v: true, t: 'High' }]} />
          <Seg label="Motion" value={prefs.reduceMotion} onPick={(v) => update({ reduceMotion: v })} options={[{ v: false, t: 'Full' }, { v: true, t: 'Reduced' }]} />
          <Seg label="Navigation bar" value={prefs.alwaysNav} onPick={(v) => update({ alwaysNav: v })} options={[{ v: false, t: 'Hide when idle' }, { v: true, t: 'Always show' }]} />
          <Seg label="Reading style" value={prefs.readable} onPick={(v) => update({ readable: v })} options={[{ v: false, t: 'Standard' }, { v: true, t: 'Easy to read' }]} />
          <Seg label="Colours" value={prefs.palette} onPick={(v) => update({ palette: v })} options={[{ v: false, t: 'Standard' }, { v: true, t: 'Colour-blind safe' }]} />
          <Seg label="Welcome animation" value={prefs.skipIntro} onPick={(v) => update({ skipIntro: v })} options={[{ v: false, t: 'Play' }, { v: true, t: 'Always skip' }]} />
          <div className="dsp-foot"><button type="button" className="btn" onClick={() => { setOpen(false); onHelp(); }}>How to use this site</button><button type="button" className="linkbtn" onClick={reset}>Reset</button></div>
          <p className="cap">Saved on this device only. We also follow your system settings for dark mode and reduced motion.</p>
        </motion.div>)}</AnimatePresence>
    </div>);
}
