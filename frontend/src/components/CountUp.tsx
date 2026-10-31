import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';

/** Number that eases up to its value. Falls back to the plain value with reduced motion. */
export function CountUp({ value, duration = 0.9 }: { value: number; duration?: number }) {
  const reduce = useReducedMotion(); const [v, setV] = useState(reduce ? value : 0); const from = useRef(0);
  useEffect(() => { if (reduce) { setV(value); return; } const c = animate(from.current, value, { duration, ease: [0.2, 0.8, 0.2, 1], onUpdate: (x) => { from.current = x; setV(Math.round(x)); } }); return () => c.stop(); }, [value, reduce, duration]);
  return <>{v.toLocaleString('en-GB')}</>;
}
