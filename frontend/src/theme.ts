import { useCallback, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

export type Theme = 'light' | 'dark';
const read = (): Theme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

/** Light/dark theme with a circular reveal from the toggle (View Transitions API), falling back to an instant switch. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(read);
  // Follow the system setting until the person chooses one themselves.
  useEffect(() => {
    const q = matchMedia('(prefers-color-scheme: dark)');
    const h = () => { let saved: string | null = null; try { saved = localStorage.getItem('theme'); } catch { /* storage blocked */ } if (!saved) { const t = q.matches ? 'dark' : 'light'; document.documentElement.dataset.theme = t; setTheme(t); } };
    q.addEventListener('change', h); return () => q.removeEventListener('change', h);
  }, []);
  const toggle = useCallback((origin?: HTMLElement | null) => {
    const next: Theme = read() === 'dark' ? 'light' : 'dark';
    const apply = () => { document.documentElement.dataset.theme = next; flushSync(() => setTheme(next)); try { localStorage.setItem('theme', next); } catch { /* ignore */ } };
    const vt = (document as any).startViewTransition?.bind(document);
    if (!vt || matchMedia('(prefers-reduced-motion: reduce)').matches) { apply(); return; }
    const r = origin?.getBoundingClientRect(); const x = r ? r.left + r.width / 2 : innerWidth - 40; const y = r ? r.top + r.height / 2 : 30;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const t = vt(apply);
    t.ready.then(() => document.documentElement.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] }, { duration: 650, easing: 'cubic-bezier(.4,0,.2,1)', pseudoElement: '::view-transition-new(root)' })).catch(() => {});
  }, []);
  return { theme, toggle };
}
