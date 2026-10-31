import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const STEPS = [
  { t: 'Explore the map', d: 'Each circle is a place. Bigger means more sightings, the ring shows how active it has been recently. Select a place name (or press Tab and Enter) to open its details.' },
  { t: 'Filter what you see', d: 'Choose dates or tap species chips at the top left. Use "Near me" to jump to your closest place.' },
  { t: 'See the bigger picture', d: 'Insights shows trends, species and regions. Hover a chart, or focus it and use the arrow keys, to read exact numbers. Every chart has a "View as table" option.' },
  { t: 'Learn and report', d: 'Learn explains how to recognise each tick and when it is active. Report lets you add a sighting with an optional photo, it appears on the map straight away.' },
];
const KEYS = [['1 – 4', 'Go to Map, Insights, Learn, Report'], ['/', 'Jump to the place picker on this page'], ['?', 'Open this guide'], ['Esc', 'Close panels and dialogs'], ['← →', 'Read a chart point by point, or move through tips']];

export function Help({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null); const prev = useRef<Element | null>(document.activeElement);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') { const f = ref.current?.querySelectorAll<HTMLElement>('button, a[href]'); if (!f?.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
    };
    window.addEventListener('keydown', k); const p = prev.current as HTMLElement | null;
    return () => { window.removeEventListener('keydown', k); p?.focus?.(); };
  }, [onClose]);
  return (
    <>
      <motion.div className="scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <div className="sp-wrap"><motion.div ref={ref} className="sp-sheet help" role="dialog" aria-modal="true" aria-labelledby="help-t" initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24 }} transition={{ type: 'spring', bounce: 0, duration: 0.4 }}>
        <div className="help-in">
          <header><h2 id="help-t" style={{ fontSize: 26 }}>How to use this site</h2><p className="sub" style={{ marginTop: 4 }}>A 30-second guide. You can open it again any time by pressing ?</p></header>
          <ol className="help-steps">{STEPS.map((s, i) => <li key={s.t}><span className="n" aria-hidden>{i + 1}</span><div><h3>{s.t}</h3><p>{s.d}</p></div></li>)}</ol>
          <section aria-labelledby="ks"><h3 id="ks" style={{ marginBottom: 8 }}>Keyboard shortcuts</h3><dl className="keys">{KEYS.map(([k, d]) => <div key={k}><dt><kbd>{k}</kbd></dt><dd>{d}</dd></div>)}</dl></section>
          <div className="actions"><button className="btn primary lg" onClick={onClose}>Got it</button></div>
        </div></motion.div></div>
    </>);
}
