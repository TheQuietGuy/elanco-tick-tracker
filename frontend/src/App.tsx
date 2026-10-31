import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { ElancoLogo } from './components/ElancoLogo';
import { useTheme } from './theme';
import { usePrefs } from './prefs';
import { Display } from './components/Display';
import { Help } from './components/Help';
import { api, ApiFailure } from './api';
import type { City, Filters, Marker, SpeciesInfo } from './types';
const MapView = lazy(() => import('./views/MapView'));
const Insights = lazy(() => import('./views/Insights'));
const Learn = lazy(() => import('./views/Learn'));
const ReportForm = lazy(() => import('./views/ReportForm'));
import Intro, { IntroBoundary, type DataStatus } from './intro/Intro';
import { getIntroMode } from './intro/introState';
import { activityLevels, EMPTY_FILTERS } from './util';

type View = 'map' | 'insights' | 'learn' | 'report';
const ICON: Record<View, string> = {
  map: 'M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4zm0 0v13m6-10.5v13',
  insights: 'M4 20V10m6 10V4m6 16v-8m5 8H3',
  learn: 'M4 5.5C4 4.7 4.7 4 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5v-15zM20 5.5c0-.8-.7-1.5-1.5-1.5H13v15h5.5c.8 0 1.5.7 1.5 1.5v-15z',
  report: 'M12 5v14M5 12h14',
};
const NAV: { id: View; label: string }[] = [{ id: 'map', label: 'Map' }, { id: 'insights', label: 'Insights' }, { id: 'learn', label: 'Learn' }, { id: 'report', label: 'Report' }];

/** The nav bar tucks away when the pointer leaves the top and slides back in when it comes close. Touch devices keep it visible. */
function useHeaderReveal(active: boolean, always: boolean) {
  const [near, setNear] = useState(true);
  useEffect(() => {
    if (!active || always || !matchMedia('(hover: hover)').matches) { setNear(true); return; }
    let t: number; const set = (v: boolean, delay: number) => { window.clearTimeout(t); t = window.setTimeout(() => setNear(v), delay); };
    set(false, 3800); // greet, then tuck away
    const move = (e: PointerEvent) => { if (e.clientY < 96) set(true, 0); else if (!document.querySelector('.topbar:focus-within')) set(false, 900); };
    const leave = () => set(false, 600); const fin = () => set(true, 0); const fout = () => set(false, 1200);
    window.addEventListener('pointermove', move, { passive: true }); document.documentElement.addEventListener('pointerleave', leave);
    const bar = document.querySelector('.topbar'); bar?.addEventListener('focusin', fin); bar?.addEventListener('focusout', fout);
    return () => { window.clearTimeout(t); window.removeEventListener('pointermove', move); document.documentElement.removeEventListener('pointerleave', leave); bar?.removeEventListener('focusin', fin); bar?.removeEventListener('focusout', fout); };
  }, [active, always]);
  return near;
}

const parseHash = (): { view: View; arg: string; arg2: string } => { const [v, a, b] = location.hash.replace(/^#\/?/, '').split('/'); return { view: (NAV.find((n) => n.id === v)?.id ?? 'map') as View, arg: a ? decodeURIComponent(a) : '', arg2: b ? decodeURIComponent(b) : '' }; };

export default function App() {
  const [introMode] = useState(getIntroMode);
  const { theme, toggle } = useTheme();
  const { prefs, update, reset } = usePrefs();
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => { const on = () => setOnline(true), off = () => setOnline(false); window.addEventListener('online', on); window.addEventListener('offline', off); return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); }; }, []);
  const [help, setHelp] = useState(false); const [nudge, setNudge] = useState(false); const [announce, setAnnounce] = useState('');
  const [showIntro, setShowIntro] = useState(introMode !== 'skip');
  const [route, setRoute] = useState(parseHash);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState(route.view === 'map' ? route.arg : '');
  const [markers, setMarkers] = useState<Marker[] | null>(null);
  const [cities, setCities] = useState<City[]>([]); const [species, setSpecies] = useState<SpeciesInfo[]>([]);
  const [status, setStatus] = useState<DataStatus>('loading'); const [loadError, setLoadError] = useState('');

  // Real readiness: the intro only reports "ready" once the API has actually answered.
  const load = useCallback(() => {
    setStatus('loading'); setLoadError('');
    Promise.all([api.markers(EMPTY_FILTERS), api.locations(), api.species()])
      .then(([m, c, s]) => { setMarkers(m); setCities(c); setSpecies(s); setStatus('ready'); })
      .catch((e: ApiFailure) => { setLoadError(e.message); setStatus('error'); });
  }, []);
  useEffect(load, [load]);
  useEffect(() => { const h = () => setRoute(parseHash()); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h); }, []);
  const go = (v: View, arg = '', arg2 = '') => { location.hash = `/${v}${arg || arg2 ? '/' + encodeURIComponent(arg) : ''}${arg2 ? '/' + encodeURIComponent(arg2) : ''}`; };
  useEffect(() => { if (route.view === 'map' && route.arg) setSelected(route.arg); if (route.view === 'map' && route.arg2) setFilters((f) => ({ ...f, species: [route.arg2] })); }, [route]);
  const near = useHeaderReveal(!showIntro, prefs.alwaysNav);
  // Page title, spoken announcement and focus move on each page change (not on first load).
  const first = useRef(true);
  useEffect(() => {
    const label = NAV.find((n) => n.id === route.view)!.label; document.title = `${label} | UK Tick Surveillance | Elanco`;
    if (first.current) { first.current = false; return; }
    setAnnounce(`${label} page`); const m = document.getElementById('main'); m?.focus({ preventScroll: true }); m?.scrollTo?.({ top: 0 });
  }, [route.view]);
  // Keyboard shortcuts (ignored while typing).
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement; if (e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return;
      if (e.key === '?') { e.preventDefault(); setHelp(true); setNudge(false); }
      else if (/^[1-4]$/.test(e.key) && !help) go(NAV[+e.key - 1].id);
      else if (e.key === '/') { e.preventDefault(); document.querySelector<HTMLElement>('select')?.focus(); }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  // One gentle first-visit offer of the guide, after the intro.
  useEffect(() => { if (showIntro) return; let seen = true; try { seen = !!localStorage.getItem('helpSeen'); } catch { /* ignore */ } if (seen) return; const t = window.setTimeout(() => setNudge(true), 1800); const t2 = window.setTimeout(() => { setNudge(false); try { localStorage.setItem('helpSeen', '1'); } catch { /* ignore */ } }, 16000); return () => { clearTimeout(t); clearTimeout(t2); }; }, [showIntro]);
  const closeNudge = () => { setNudge(false); try { localStorage.setItem('helpSeen', '1'); } catch { /* ignore */ } };
  const levels = useMemo(() => activityLevels(markers), [markers]);
  const onSelect = (l: string) => { setSelected(l); history.replaceState(null, '', l ? `#/map/${encodeURIComponent(l)}` : '#/map'); };

  return (
    <MotionConfig reducedMotion={prefs.reduceMotion ? 'always' : 'user'}><div className="shell">
      <div className="shell" inert={showIntro} aria-hidden={showIntro}>
        <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to main content</a>
        <header className={`topbar${near ? '' : ' away'}`}>
          <ElancoLogo className="logo" height={30} /><span className="title">UK Tick Surveillance</span>
          <nav className="seg-nav" aria-label="Main">{NAV.map((n) => <button key={n.id} aria-label={n.label} title={n.label} aria-current={route.view === n.id ? 'page' : undefined} onClick={() => go(n.id)}>{route.view === n.id && <motion.span layoutId="nav-pill" className="pill" transition={{ type: 'spring', bounce: 0, duration: 0.35 }} />}
            <svg className="ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={ICON[n.id]} /></svg>
            <span className="l">{n.label}</span></button>)}</nav>
          <Display prefs={prefs} update={update} reset={reset} onHelp={() => { setHelp(true); closeNudge(); }} />
          <button className="theme-btn" onClick={(e) => toggle(e.currentTarget)} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
            <AnimatePresence mode="wait" initial={false}><motion.svg key={theme} width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden initial={{ rotate: -90, scale: 0.4, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }} exit={{ rotate: 90, scale: 0.4, opacity: 0 }} transition={{ duration: 0.22 }}>
              {theme === 'dark' ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></> : <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" />}
            </motion.svg></AnimatePresence></button>
        </header>
        <button className="topbar-handle" aria-hidden tabIndex={-1} onClick={() => window.scrollTo(0, 0)} style={{ pointerEvents: 'none' }}><i /></button>
        <main className="main" id="main" tabIndex={-1} key={String(prefs.palette)}>
          <Suspense fallback={<div className="page" aria-busy="true"><div className="skeleton" style={{ height: 120 }} /><div className="skeleton" style={{ height: 320 }} /></div>}>
          {status === 'error' && <div className="banner error" role="alert" style={{ position: 'absolute', zIndex: 1300, top: 12, left: 12, right: 12, display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}><span>{loadError}</span><button className="btn" onClick={load}>Try again</button></div>}
          {route.view === 'map' && <MapView initial={markers} levels={levels} filters={filters} setFilters={setFilters} cities={cities} selected={selected} setSelected={onSelect} onReport={(l) => go('report', l)} onInsights={(l) => go('insights', l)} onLearn={(sp) => go('learn', '', sp)} />}
          {route.view === 'insights' && <Insights cities={cities} levels={levels} markers={markers} initialLoc={route.arg} onMap={(l, sp) => go('map', l, sp)} onLearn={(sp) => go('learn', '', sp)} />}
          {route.view === 'learn' && <Learn cities={cities} openSpecies={route.arg2} onReport={(sp) => go('report', '', sp)} onMap={(l, sp) => go('map', l, sp)} />}
          {route.view === 'report' && <ReportForm cities={cities} species={species} presetLocation={route.arg} presetSpecies={route.arg2} levels={levels} onViewMap={(l) => go('map', l)} onLearn={(sp) => go('learn', '', sp)} />}
          </Suspense>
        </main>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
      {!online && <div className="offline" role="status">You are offline. What you have already loaded stays here, and new data will load when you reconnect.</div>}
      <AnimatePresence>{help && <Help key="help" onClose={() => { setHelp(false); closeNudge(); }} />}</AnimatePresence>
      <AnimatePresence>{nudge && !help && (
        <motion.div className="nudge glass" role="status" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} transition={{ type: 'spring', bounce: 0, duration: 0.45 }}>
          <span><b>New here?</b> A 30-second guide shows how everything works.</span>
          <button className="btn primary" onClick={() => { setHelp(true); closeNudge(); }}>Show me</button><button className="btn" onClick={closeNudge}>Not now</button>
        </motion.div>)}</AnimatePresence>
      {showIntro && introMode !== 'skip' && (<IntroBoundary onFail={() => setShowIntro(false)}><Intro mode={introMode} dataStatus={status} onDone={() => setShowIntro(false)} /></IntroBoundary>)}
    </div></MotionConfig>);
}
