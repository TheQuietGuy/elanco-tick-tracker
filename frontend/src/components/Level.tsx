import type { Level } from '../types';
import { LEVEL } from '../util';

/** Severity badge. Never colour-only: the label is always shown, and the shape changes with level. */
export function LevelBadge({ level, prefix = '' }: { level: Level; prefix?: string }) {
  const l = LEVEL[level];
  return <span className="lvl" style={{ ['--lc' as any]: l.color }}><i className={`bars b-${level}`} aria-hidden><b /><b /><b /></i>{prefix}{l.label}</span>;
}
