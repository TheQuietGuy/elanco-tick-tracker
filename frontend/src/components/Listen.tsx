import { useEffect, useState } from 'react';

/** Reads text aloud with the browser's built-in speech (no data leaves the device). Hidden where unsupported. */
export function Listen({ text, label = 'Listen' }: { text: string; label?: string }) {
  const ok = typeof window !== 'undefined' && 'speechSynthesis' in window; const [on, setOn] = useState(false);
  useEffect(() => () => { if (ok) window.speechSynthesis.cancel(); }, [ok]);
  if (!ok) return null;
  const toggle = () => {
    const s = window.speechSynthesis;
    if (on) { s.cancel(); setOn(false); return; }
    const u = new SpeechSynthesisUtterance(text); u.lang = 'en-GB'; u.onend = () => setOn(false); u.onerror = () => setOn(false);
    s.cancel(); s.speak(u); setOn(true);
  };
  return <button type="button" className="btn no-print" onClick={toggle} aria-pressed={on}>{on ? 'Stop reading' : `🔊 ${label}`}</button>;
}
