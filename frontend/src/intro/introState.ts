export type IntroMode = 'full' | 'short' | 'reduced' | 'skip';
const SESSION_KEY = 'elanco.intro.session'; const SEEN_KEY = 'elanco.intro.seen';
const safe = <T,>(fn: () => T, fallback: T): T => { try { return fn(); } catch { return fallback; } };
/** Storage can be blocked (private mode), so every access is guarded. */
export function getIntroMode(): IntroMode {
  if (safe(() => !!JSON.parse(localStorage.getItem('prefs') || '{}').skipIntro, false)) return 'skip';
  if (safe(() => sessionStorage.getItem(SESSION_KEY), null)) return 'skip';
  if (safe(() => matchMedia('(prefers-reduced-motion: reduce)').matches, false)) return 'reduced';
  if (safe(() => localStorage.getItem(SEEN_KEY), null)) return 'short';
  return 'full';
}
export const markIntroSeen = () => { safe(() => sessionStorage.setItem(SESSION_KEY, '1'), undefined); safe(() => localStorage.setItem(SEEN_KEY, '1'), undefined); };
export const isMobile = () => safe(() => matchMedia('(max-width: 720px)').matches, false);
