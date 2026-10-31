import { useId } from 'react';

interface Look { body: string; shield: string; legs: string; rx: number; ry: number; mouth: number; ornate?: boolean }
// Original illustrations, drawn to show each species' general look (size, colour, shield pattern, mouthparts). Not to scale.
const LOOK: Record<string, Look> = {
  'Fox/badger tick': { body: '#b0623f', shield: '#7a3d27', legs: '#8a4a30', rx: 21, ry: 25, mouth: 8 },
  'Marsh tick': { body: '#4a3a33', shield: '#2b211d', legs: '#d9c8a8', rx: 19, ry: 24, mouth: 8 },
  'Passerine tick': { body: '#8d6a47', shield: '#6c4c31', legs: '#6c4c31', rx: 25, ry: 28, mouth: 9, ornate: true },
  'Southern rodent tick': { body: '#c2965a', shield: '#98703a', legs: '#a98048', rx: 14, ry: 31, mouth: 15 },
  'Tree-hole tick': { body: '#d2b387', shield: '#b2905f', legs: '#bf9d6c', rx: 16, ry: 19, mouth: 7 },
};

export function TickArt({ species, size = 112, label = true }: { species: string; size?: number; label?: boolean }) {
  const a = LOOK[species] ?? LOOK['Fox/badger tick']; const id = useId().replace(/:/g, '');
  const cx = 60, cy = 74; const shieldRy = a.ry * 0.46, shieldRx = a.rx * 0.78, shieldCy = cy - a.ry * 0.5;
  const legs = [0, 1, 2, 3].flatMap((i) => {
    const yy = cy - a.ry * 0.62 + i * a.ry * 0.42, lift = (i - 1.5) * 8;
    return [1, -1].map((dir) => ({ key: `${i}${dir}`, d: `M${cx + dir * a.rx * 0.78} ${yy} Q${cx + dir * (a.rx + 12)} ${yy - 7 + lift * 0.3} ${cx + dir * (a.rx + 19)} ${yy + lift}` }));
  });
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role={label ? 'img' : undefined} aria-label={label ? `Illustration of a ${species}` : undefined} aria-hidden={label ? undefined : true}>
      <defs>
        <radialGradient id={`b${id}`} cx="38%" cy="30%" r="80%"><stop offset="0" stopColor="#fff" stopOpacity=".5" /><stop offset=".45" stopColor={a.body} /><stop offset="1" stopColor={a.body} stopOpacity=".92" /></radialGradient>
        <radialGradient id={`s${id}`} cx="40%" cy="30%" r="80%"><stop offset="0" stopColor="#fff" stopOpacity=".38" /><stop offset=".6" stopColor={a.shield} /></radialGradient>
      </defs>
      <ellipse cx={cx} cy={cy + a.ry + 4} rx={a.rx * 1.05} ry="4" fill="#111c2e" opacity=".12" />
      {legs.map((l) => <path key={l.key} d={l.d} stroke={a.legs} strokeWidth="3.2" strokeLinecap="round" fill="none" />)}
      <rect x={cx - 3.5} y={cy - a.ry - a.mouth} width="7" height={a.mouth + 6} rx="3.5" fill={a.shield} />
      <rect x={cx - 8} y={cy - a.ry - a.mouth * 0.6} width="4" height={a.mouth * 0.8} rx="2" fill={a.shield} opacity=".9" /><rect x={cx + 4} y={cy - a.ry - a.mouth * 0.6} width="4" height={a.mouth * 0.8} rx="2" fill={a.shield} opacity=".9" />
      <ellipse cx={cx} cy={cy} rx={a.rx} ry={a.ry} fill={`url(#b${id})`} />
      <ellipse cx={cx} cy={shieldCy} rx={shieldRx} ry={shieldRy} fill={`url(#s${id})`} />
      {a.ornate && [[-8, -3, 5, 3], [7, -2, 4.5, 3.2], [0, 4, 6, 2.6], [-4, -8, 3.5, 2.4], [6, 5, 3, 2.2]].map(([dx, dy, rx, ry], i) => <ellipse key={i} cx={cx + dx} cy={shieldCy + dy} rx={rx} ry={ry} fill="#f3e5c5" opacity=".85" />)}
      <path d={`M${cx - a.rx * 0.55} ${cy + a.ry * 0.25} Q${cx} ${cy + a.ry * 0.6} ${cx + a.rx * 0.55} ${cy + a.ry * 0.25}`} stroke="#fff" strokeOpacity=".18" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>);
}
