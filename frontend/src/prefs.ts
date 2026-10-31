import { applyPalette } from './util';
import { useCallback, useEffect, useState } from 'react';

export interface Prefs { size: 0 | 1 | 2; contrast: boolean; reduceMotion: boolean; alwaysNav: boolean; readable: boolean; palette: boolean; skipIntro: boolean }
const DEFAULTS: Prefs = { size: 0, contrast: false, reduceMotion: false, alwaysNav: false, readable: false, palette: false, skipIntro: false };
const SCALE = ['1', '1.15', '1.3'];
const load = (): Prefs => { let p = DEFAULTS; try { p = { ...DEFAULTS, ...JSON.parse(localStorage.getItem('prefs') || '{}') }; } catch { /* use defaults */ } applyPalette(p.palette); return p; };
function apply(p: Prefs) {
  const r = document.documentElement; r.dataset.size = String(p.size); r.dataset.contrast = p.contrast ? 'high' : ''; r.dataset.motion = p.reduceMotion ? 'reduce' : ''; r.dataset.readable = p.readable ? 'on' : ''; r.style.setProperty('--ts', SCALE[p.size]);
}

/** Display and accessibility preferences, remembered on this device. */
export function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(load);
  useEffect(() => { apply(prefs); }, [prefs]);
  const update = useCallback((patch: Partial<Prefs>) => setPrefs((p) => { const n = { ...p, ...patch }; applyPalette(n.palette); try { localStorage.setItem('prefs', JSON.stringify(n)); } catch { /* storage blocked */ } return n; }), []);
  const reset = useCallback(() => { try { localStorage.removeItem('prefs'); } catch { /* ignore */ } applyPalette(false); setPrefs(DEFAULTS); }, []);
  return { prefs, update, reset };
}
