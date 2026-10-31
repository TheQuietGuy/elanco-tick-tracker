// Lightweight Web Audio cues, loaded lazily and only after the user switches sound on. Every call is failure-safe.
export type Cue = 'powerOn' | 'chime' | 'scan' | 'beep' | 'confirm';
export interface Sound { play(cue: Cue): void; dispose(): void }
export function createSound(): Sound | null {
  try {
    const Ctx = window.AudioContext ?? (window as any).webkitAudioContext; if (!Ctx) return null;
    const ctx: AudioContext = new Ctx(); void ctx.resume();
    const master = ctx.createGain(); master.gain.value = 0.05; master.connect(ctx.destination);
    const tone = (f0: number, f1: number, dur: number, type: OscillatorType = 'sine', at = 0, peak = 1) => {
      const t = ctx.currentTime + at; const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
    };
    const cues: Record<Cue, () => void> = {
      powerOn: () => tone(90, 220, 0.7, 'sine', 0, 0.9),
      chime: () => { tone(880, 880, 0.9, 'sine', 0.05, 0.5); tone(1320, 1320, 0.9, 'sine', 0.05, 0.25); },
      scan: () => tone(300, 700, 1.1, 'triangle', 0, 0.25),
      beep: () => { tone(1040, 1040, 0.07, 'square', 0, 0.2); tone(1040, 1040, 0.07, 'square', 0.14, 0.2); },
      confirm: () => { tone(660, 660, 0.14, 'sine', 0, 0.6); tone(990, 990, 0.3, 'sine', 0.12, 0.6); },
    };
    return { play: (c) => { try { cues[c](); } catch { /* audio must never break the UI */ } }, dispose: () => { try { void ctx.close(); } catch { /* ignore */ } } };
  } catch { return null; }
}
