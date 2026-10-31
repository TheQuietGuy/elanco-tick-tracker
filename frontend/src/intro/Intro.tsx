import { Component, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { TickArt } from '../components/TickArt';
import { SPECIES_COLOR } from '../util';
import { LINKS, PINS, UK_PATHS, VIEWBOX } from './ukOutline';
import { markIntroSeen, isMobile, type IntroMode } from './introState';
import type { Sound, Cue } from './sound';
import { ElancoLogo } from '../components/ElancoLogo';
import './intro.css';

const SPECIES_NAMES = Object.keys(SPECIES_COLOR);
export type DataStatus = 'loading' | 'ready' | 'error';
/** 'spec' keeps the whole sequence inside the 5-7 second range in docs/intro-feature-spec.json. 'extended' is the longer, loading-screen style version. */
export const INTRO_LENGTH: 'spec' | 'extended' = 'extended';
const TIMINGS = { spec: [1200, 1300, 1500, 1200, 700], extended: [1700, 1900, 2300, 1900, 900] }[INTRO_LENGTH];
const STRETCH = INTRO_LENGTH === 'extended' ? 8400 / 5900 : 1;
const TIPS = [
  'Ticks are most active from spring to autumn, but they can be found at other times too.',
  'After a walk, check your pet\'s ears, neck, armpits, groin and between the toes.',
  'Five tick species are tracked on this map, from the fox/badger tick to the tree-hole tick.',
  'Remove an attached tick promptly with a tick-removal tool or fine-tipped tweezers.',
  'Every sighting you report helps vets and pet owners see where ticks are active.',
];
const STEPS = [
  { name: 'Initialisation', text: 'INITIALISING SURVEILLANCE SYSTEM', ms: TIMINGS[0], cue: 'powerOn' as Cue },
  { name: 'Data connection', text: 'CONNECTING TO DATA SOURCES', ms: TIMINGS[1], cue: 'scan' as Cue },
  { name: 'Map visualisation', text: 'PREPARING UK ACTIVITY MAP', ms: TIMINGS[2], cue: 'beep' as Cue },
  { name: 'Data preparation', text: 'PREPARING SIGHTING DATABASE', ms: TIMINGS[3], cue: 'beep' as Cue },
  { name: 'Ready', text: 'SURVEILLANCE SYSTEM READY', ms: TIMINGS[4], cue: 'confirm' as Cue },
];
const EXIT_MS = 450;
// Full desktop run: 1.2+1.3+1.5+1.2+0.7 = 5.9s + 0.45s exit = 6.35s (spec ceiling 7s). Mobile runs at 65%.
// If data still isn't ready at the 6.0s cap we leave without claiming READY.
const HARD_CAP_MS = INTRO_LENGTH === 'extended' ? 9500 : 6000;

interface Props { mode: Exclude<IntroMode, 'skip'>; dataStatus: DataStatus; onDone: () => void }

/** The intro never blocks the product: any render error simply hands over to the dashboard. */
export class IntroBoundary extends Component<{ onFail: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFail(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function Intro({ mode, dataStatus, onDone }: Props) {
  const mobile = useMemo(isMobile, []);
  const scale = mobile ? 0.65 : 1;
  const [step, setStep] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const soundRef = useRef<Sound | null>(null);
  const statusRef = useRef(dataStatus); statusRef.current = dataStatus;
  const doneRef = useRef(false);
  const full = mode === 'full';

  const finish = useCallback(() => {
    if (doneRef.current) return; doneRef.current = true; setLeaving(true); markIntroSeen();
    soundRef.current?.dispose();
    window.setTimeout(onDone, mode === 'reduced' ? 150 : EXIT_MS * scale);
  }, [onDone, mode, scale]);

  // Sound is off by default and only created after an explicit click (autoplay policy + spec).
  const toggleSound = async () => {
    if (soundOn) { soundRef.current?.dispose(); soundRef.current = null; setSoundOn(false); return; }
    try { const { createSound } = await import('./sound'); soundRef.current = createSound(); setSoundOn(!!soundRef.current); soundRef.current?.play(STEPS[step].cue); }
    catch { setSoundOn(false); }
  };
  useEffect(() => { if (soundOn && full) { soundRef.current?.play(STEPS[step].cue); if (step === 0) window.setTimeout(() => soundRef.current?.play('chime'), 450 * scale); } }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Full sequence. READY is gated on the real load state.
  useEffect(() => {
    if (!full || leaving) return;
    const timers: number[] = []; let elapsed = 0; const t0 = performance.now();
    STEPS.slice(0, 3).forEach((s, i) => { elapsed += s.ms * scale; timers.push(window.setTimeout(() => setStep(i + 1), elapsed)); });
    const gateAt = (STEPS[0].ms + STEPS[1].ms + STEPS[2].ms + STEPS[3].ms) * scale;
    const cap = HARD_CAP_MS * scale;
    const gate = () => {
      if (statusRef.current === 'ready') { setStep(4); timers.push(window.setTimeout(finish, STEPS[4].ms * scale)); }
      else if (statusRef.current === 'error' || performance.now() - t0 >= cap) finish();
      else timers.push(window.setTimeout(gate, 100));
    };
    timers.push(window.setTimeout(gate, gateAt));
    return () => timers.forEach(clearTimeout);
  }, [full, leaving, scale, finish]);

  // Returning visitor / reduced motion: brief hold, then hand over once the data state is known.
  useEffect(() => {
    if (full || leaving) return;
    const min = mode === 'reduced' ? 1200 : 1100; const cap = mode === 'reduced' ? 3000 : 2600; const t0 = performance.now();
    const id = window.setInterval(() => {
      const el = performance.now() - t0;
      if (el >= cap || (el >= min && statusRef.current !== 'loading')) { window.clearInterval(id); if (statusRef.current === 'ready') setStep(4); finish(); }
    }, 100);
    return () => window.clearInterval(id);
  }, [full, mode, leaving, finish]);

  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') finish(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [finish]);
  useEffect(() => () => { soundRef.current?.dispose(); }, []);

  // Lift the logo to just below the top of the stage, whatever the stage height turns out to be (the footer is taller now).
  const stageRef = useRef<HTMLDivElement>(null); const [lift, setLift] = useState(() => Math.round((typeof window === 'undefined' ? 800 : window.innerHeight) * 0.22));
  useEffect(() => { const el = stageRef.current; if (!el) return; const f = () => setLift(Math.max(40, Math.round(el.clientHeight / 2 - (mobile ? 100 : 62)))); f(); const ro = new ResizeObserver(f); ro.observe(el); return () => ro.disconnect(); }, [mobile]);
  const showMap = full || mode === 'reduced';
  const mapOn = step >= 2 || mode === 'reduced';
  const status = full ? STEPS[step].text : mode === 'reduced' ? (dataStatus === 'ready' ? STEPS[4].text : STEPS[0].text) : (step === 4 ? STEPS[4].text : STEPS[0].text);
  const dur = (s: number) => s * scale * STRETCH;

  return (
    <motion.div className="intro" role="dialog" aria-modal="true" aria-label="System initialisation"
      initial={{ opacity: 1 }} animate={leaving ? { opacity: 0, scale: mode === 'reduced' ? 1 : 1.08 } : { opacity: 1, scale: 1 }}
      transition={{ duration: leaving ? (mode === 'reduced' ? 0.15 : (EXIT_MS / 1000) * scale) : 0, ease: [0.4, 0, 0.2, 1] }}>
      <div className="intro-grid" aria-hidden /><div className="intro-vignette" aria-hidden />
      <div className="intro-controls">
        <button type="button" className="intro-btn" onClick={toggleSound} aria-pressed={soundOn} aria-label={soundOn ? 'Turn sound off' : 'Turn sound on'}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M11 5 6 9H2v6h4l5 4V5z" />{soundOn ? <><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M19 5a10 10 0 0 1 0 14" /></> : <path d="m22 9-6 6m0-6 6 6" />}
          </svg><span>Sound {soundOn ? 'on' : 'off'}</span>
        </button>
        <button type="button" className="intro-btn" onClick={finish} autoFocus>Skip intro</button>
      </div>

      {full && !leaving && <>
        <motion.div className="scanline" aria-hidden initial={{ top: '-2%', opacity: 0 }} animate={{ top: ['-2%', '102%'], opacity: [0, 0.55, 0.55, 0] }} transition={{ delay: dur(1.2), duration: dur(1.8), ease: 'linear' }} />
        <Particles count={mobile ? 14 : 26} start={dur(1.2)} />
      </>}

      <div className="intro-stage" ref={stageRef}>
        {full && !leaving && step === 1 && <Streams dur={dur} />}
        <motion.div className="intro-logo" initial={{ opacity: 0, filter: 'blur(8px)', y: 0, scale: 1.35 }}
          animate={{ opacity: 1, filter: 'blur(0px)', y: step === 0 && full ? 0 : -lift, scale: step === 0 && full ? 1.35 : 1 }}
          transition={full ? { opacity: { delay: dur(0.35), duration: dur(0.7) }, filter: { delay: dur(0.35), duration: dur(0.7) }, y: { type: 'spring', bounce: 0, duration: dur(0.9) }, scale: { type: 'spring', bounce: 0, duration: dur(0.9) } } : { duration: 0.4 }}>
          <motion.div className="logo-wipe" initial={{ clipPath: full ? 'inset(-40px 100% -40px -40px)' : 'inset(-40px -40px -40px -40px)' }} animate={{ clipPath: 'inset(-40px -40px -40px -40px)' }} transition={{ delay: dur(0.35), duration: dur(0.8), ease: [0.4, 0, 0.2, 1] }}>
            <ElancoLogo height={mobile ? 62 : 84} style={{ fill: step === 4 ? '#7fe0b4' : '#4da3f0', transition: 'fill .5s', filter: 'drop-shadow(0 0 18px rgba(77,163,240,.45))' }} />
            {full && <span className="shine-box" aria-hidden><motion.i className="shine" aria-hidden initial={{ x: '-120%', opacity: 0 }} animate={{ x: '300%', opacity: [0, 1, 1, 0] }} transition={{ delay: dur(1.1), duration: dur(0.9), ease: 'easeInOut' }} /></span>}
          </motion.div>
        </motion.div>
        {full && <motion.div className="power-line" aria-hidden initial={{ scaleX: 0, opacity: 0.9 }} animate={{ scaleX: 1, opacity: step === 0 ? 0.9 : 0 }} transition={{ duration: dur(0.5), opacity: { duration: dur(0.6), delay: dur(0.2) } }} />}

        {showMap && (
          <div className="map-wrap">{full && step >= 3 && <motion.div className="radar" aria-hidden initial={{ opacity: 0, rotate: 0 }} animate={{ opacity: step === 4 ? 0 : 1, rotate: 360 }} transition={{ opacity: { duration: 0.4 }, rotate: { duration: dur(1.4), ease: 'linear', repeat: Infinity } }} />}
          <svg className="intro-map" viewBox={VIEWBOX} role="img" aria-label="Stylised outline of the United Kingdom with sighting points">
            {UK_PATHS.map((d, i) => (
              <motion.path key={i} d={d} fill="rgba(41,111,183,0.08)" stroke="#5aa2ee" strokeWidth={1.4} strokeLinejoin="round"
                initial={{ pathLength: mode === 'reduced' ? 1 : 0, fillOpacity: mode === 'reduced' ? 1 : 0, opacity: mode === 'reduced' ? 1 : 0 }}
                animate={mapOn ? { pathLength: 1, fillOpacity: 1, opacity: 1 } : {}} transition={{ duration: dur(1.5), ease: [0.4, 0, 0.2, 1], opacity: { duration: dur(0.3) } }} />
            ))}
            {LINKS.map(([a, b], i) => (
              <motion.line key={i} x1={PINS[a].x} y1={PINS[a].y} x2={PINS[b].x} y2={PINS[b].y} stroke="#5aa2ee" strokeWidth={0.6} strokeOpacity={0.5}
                initial={{ pathLength: mode === 'reduced' ? 1 : 0, opacity: mode === 'reduced' ? 1 : 0 }} animate={step >= 3 || mode === 'reduced' ? { pathLength: 1, opacity: 1 } : {}} transition={{ duration: dur(0.9), delay: dur(0.04 * i) }} />
            ))}
            {PINS.map((p, i) => (
              <g key={p.name}>
                <motion.circle cx={p.x} cy={p.y} r={7} fill="#5aa2ee" initial={{ opacity: 0, scale: 0.2 }} animate={step >= 2 && full ? { opacity: [0, 0.35, 0], scale: [0.4, 1.6, 2] } : {}} transition={{ delay: dur(0.7 + i * 0.05), duration: dur(0.9) }} style={{ transformOrigin: `${p.x}px ${p.y}px` }} />
                <motion.circle cx={p.x} cy={p.y} r={3} fill={step === 4 ? '#7fe0b4' : '#8cc2ff'} initial={{ opacity: mode === 'reduced' ? 1 : 0, scale: mode === 'reduced' ? 1 : 0 }} animate={mapOn ? { opacity: 1, scale: 1 } : {}} transition={{ type: 'spring', bounce: 0, duration: dur(0.5), delay: dur(0.7 + i * 0.05) }} style={{ transformOrigin: `${p.x}px ${p.y}px` }} />
              </g>
            ))}
            {full && step === 3 && <motion.circle cx={165} cy={290} r={4} fill="none" stroke="#8cc2ff" strokeWidth={0.8} initial={{ r: 4, opacity: 0.8 }} animate={{ r: 150, opacity: 0 }} transition={{ duration: dur(1.2), ease: 'easeOut' }} />}
          </svg></div>
        )}
        <div className="intro-hud" aria-hidden><span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" /></div>
      </div>

      <div className="intro-footer">
        {full && <div className="stage-no" aria-hidden><b>{String(step + 1).padStart(2, '0')}</b><span>/ 05</span></div>}
        {status && <motion.p key={status} className="intro-status" aria-hidden initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}><Decode text={status} on={full} ms={dur(0.55) * 1000} /></motion.p>}
        {full && <>
          <div className="specimens" aria-hidden>{step >= 3 && SPECIES_NAMES.map((n, k) => (
            <motion.span key={n} className="spec" style={{ ['--c' as any]: SPECIES_COLOR[n] }} initial={{ opacity: 0, y: 14, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', bounce: 0.15, duration: 0.5, delay: dur(0.12 * k) }}>
              <TickArt species={n} size={34} label={false} /><i>{n.replace(' tick', '')}</i></motion.span>))}</div>
          <div className="intro-bar" aria-hidden>{STEPS.map((s, k) => (
            <span key={s.name} className="bseg"><motion.i initial={{ width: '0%' }} animate={{ width: k < step ? '100%' : k === step ? '100%' : '0%' }} transition={k === step ? { duration: (s.ms / 1000) * scale, ease: 'linear' } : { duration: 0.2 }} /></span>))}</div>
          <div className="intro-meta" aria-hidden><span>STEP {step + 1} OF {STEPS.length}</span><span className={`link ${dataStatus}`}><i />DATA LINK {dataStatus === 'ready' ? 'RECEIVED' : dataStatus === 'error' ? 'UNAVAILABLE' : 'WAITING'}</span></div>
          <div className="intro-tip" aria-hidden><AnimatePresence mode="wait"><motion.p key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}><b>DID YOU KNOW</b>{TIPS[step]}</motion.p></AnimatePresence></div>
        </>}
        <p className="sr-only" aria-live="polite">{status}</p>
      </div>
    </motion.div>
  );
}

/** Slow-drifting data points with seeded positions, so there's no per-render flicker. */
function Particles({ count, start }: { count: number; start: number }) {
  const pts = useMemo(() => Array.from({ length: count }, (_, i) => {
    const r = (n: number) => { const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
    return { x: r(1) * 100, y: r(2) * 100, s: 1 + r(3) * 1.6, d: 2.5 + r(4) * 2, dl: r(5) * 1.2 };
  }), [count]);
  return <div className="particles" aria-hidden>{pts.map((p, i) => (
    <motion.i key={i} style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s }} initial={{ opacity: 0 }} animate={{ opacity: [0, 0.6, 0], y: [0, -18] }} transition={{ delay: start + p.dl, duration: p.d, ease: 'easeOut' }} />
  ))}</div>;
}

/** Status text that resolves from random glyphs. Plain text when motion is off (the screen-reader copy is separate). */
function Decode({ text, on, ms }: { text: string; on: boolean; ms: number }) {
  const [out, setOut] = useState(on ? '' : text);
  useEffect(() => {
    if (!on) { setOut(text); return; }
    const G = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/'; const t0 = performance.now(); let raf = 0;
    const tick = () => { const p = Math.min(1, (performance.now() - t0) / ms); const fixed = Math.floor(p * text.length);
      setOut(text.split('').map((c, i) => (c === ' ' || i < fixed ? c : G[Math.floor(Math.random() * G.length)])).join('')); if (p < 1) raf = requestAnimationFrame(tick); else setOut(text); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [text, on, ms]);
  return <>{out}</>;
}

/** Data lines converging on the centre while "connecting". Decorative only: it does not represent real network state. */
function Streams({ dur }: { dur: (s: number) => number }) {
  const lines = useMemo(() => Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2 + 0.3; return { x: 50 + Math.cos(a) * 62, y: 50 + Math.sin(a) * 62, d: i * 0.05 }; }), []);
  return <svg className="streams" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden>{lines.map((l, i) => (
    <motion.line key={i} x1={l.x} y1={l.y} x2={50} y2={50} stroke="#5aa2ee" strokeWidth={0.18} strokeDasharray="0.6 2.2" initial={{ opacity: 0, strokeDashoffset: 0 }} animate={{ opacity: [0, 0.8, 0.8, 0], strokeDashoffset: -18 }} transition={{ delay: dur(l.d), duration: dur(1.2), ease: 'linear' }} />))}
    <motion.circle cx={50} cy={50} r={3} fill="none" stroke="#8cc2ff" strokeWidth={0.25} initial={{ r: 3, opacity: 0.7 }} animate={{ r: 30, opacity: 0 }} transition={{ delay: dur(0.5), duration: dur(0.9), ease: 'easeOut' }} />
  </svg>;
}
